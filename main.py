from fastapi import FastAPI, HTTPException, Request, Depends, Form, Cookie
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.encoders import jsonable_encoder
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import json
from collections import defaultdict
import secrets
import hashlib

from models import (
    Company, CompanyCreate, CompanyUpdate, 
    Menu, MenuCreate, MenuItem, MenuItemCreate, MenuItemUpdate,
    Rating, RatingSubmission, Submission,
    AnalyticsResponse
)
from database import (
    companies_collection, menus_collection, 
    ratings_collection, submissions_collection,
    ping_database
)

app = FastAPI(title="Food Deck Rating System", version="1.0.0")

# Static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Admin authentication
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin"
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"

# Store active sessions (in production, use Redis or database)
active_sessions = set()

def create_session_token(username: str) -> str:
    """Create a session token for the user"""
    token_data = f"{username}:{secrets.token_urlsafe(32)}"
    return hashlib.sha256(token_data.encode()).hexdigest()

def verify_admin_session(session_token: str = Cookie(None, alias="admin_session")):
    """Verify admin session token"""
    if not session_token or session_token not in active_sessions:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    return True

@app.on_event("startup")
async def startup_event():
    """Test database connection on startup"""
    connected = await ping_database()
    if connected:
        print("✅ Connected to MongoDB successfully")
    else:
        print("❌ Failed to connect to MongoDB")

# Health Check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Company Management Endpoints
@app.post("/api/companies")
async def create_company(company: CompanyCreate, admin: str = Depends(verify_admin_session)):
    """Create a new company"""
    company_dict = company.model_dump()
    company_dict["created_at"] = datetime.utcnow()
    
    result = await companies_collection.insert_one(company_dict)
    created_company = await companies_collection.find_one({"_id": result.inserted_id})
    
    # Convert ObjectId to string manually
    created_company["id"] = str(created_company.pop("_id"))
    return created_company

@app.get("/api/companies")
async def get_companies(admin: str = Depends(verify_admin_session)):
    """Get all companies"""
    companies = []
    async for company in companies_collection.find():
        # Convert ObjectId to string manually
        company["id"] = str(company.pop("_id"))
        companies.append(company)
    return companies

@app.get("/api/companies/{company_id}")
async def get_company(company_id: str):
    """Get a specific company"""
    if not ObjectId.is_valid(company_id):
        raise HTTPException(status_code=400, detail="Invalid company ID")
    
    company = await companies_collection.find_one({"_id": ObjectId(company_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Convert ObjectId to string manually
    company["id"] = str(company.pop("_id"))
    return company

@app.put("/api/companies/{company_id}")
async def update_company(company_id: str, company_update: CompanyUpdate, admin: str = Depends(verify_admin_session)):
    """Update a company"""
    if not ObjectId.is_valid(company_id):
        raise HTTPException(status_code=400, detail="Invalid company ID")
    
    update_data = {k: v for k, v in company_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await companies_collection.update_one(
        {"_id": ObjectId(company_id)}, 
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    
    updated_company = await companies_collection.find_one({"_id": ObjectId(company_id)})
    # Convert ObjectId to string manually
    updated_company["id"] = str(updated_company.pop("_id"))
    return updated_company

@app.delete("/api/companies/{company_id}")
async def delete_company(company_id: str, admin: str = Depends(verify_admin_session)):
    """Delete a company and all associated data"""
    if not ObjectId.is_valid(company_id):
        raise HTTPException(status_code=400, detail="Invalid company ID")
    
    # Check if company exists
    company = await companies_collection.find_one({"_id": ObjectId(company_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Delete associated data in correct order
    # 1. Delete ratings
    ratings_result = await ratings_collection.delete_many({"company_id": company_id})
    
    # 2. Delete submissions  
    submissions_result = await submissions_collection.delete_many({"company_id": company_id})
    
    # 3. Delete menus
    menus_result = await menus_collection.delete_many({"company_id": company_id})
    
    # 4. Finally delete the company
    company_result = await companies_collection.delete_one({"_id": ObjectId(company_id)})
    
    return {
        "message": "Company and all associated data deleted successfully",
        "deleted_counts": {
            "company": company_result.deleted_count,
            "menus": menus_result.deleted_count,
            "submissions": submissions_result.deleted_count,
            "ratings": ratings_result.deleted_count
        }
    }

# Menu Management Endpoints
@app.post("/api/menu/{company_id}")
async def create_menu(company_id: str, menu_create: MenuCreate, replace: bool = True, admin: str = Depends(verify_admin_session)):
    """Create a new menu or replace/add to existing menu for a company on a specific date"""
    if not ObjectId.is_valid(company_id):
        raise HTTPException(status_code=400, detail="Invalid company ID")
    
    # Verify company exists
    company = await companies_collection.find_one({"_id": ObjectId(company_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Check if menu already exists for this date
    existing_menu = await menus_collection.find_one({
        "company_id": company_id,
        "date": menu_create.date
    })
    
    menu_dict = menu_create.model_dump()
    menu_dict["created_at"] = datetime.utcnow()
    
    # Generate ObjectIds for menu items
    for item in menu_dict.get("items", []):
        if "_id" not in item:
            item["_id"] = ObjectId()
    
    if existing_menu:
        if replace:
            # Replace the entire menu (used by "Add Menu" functionality)
            result = await menus_collection.update_one(
                {"_id": existing_menu["_id"]},
                {"$set": menu_dict}
            )
        else:
            # Add items to existing menu (used by "Add Items" functionality)
            new_items = menu_dict.get("items", [])
            result = await menus_collection.update_one(
                {"_id": existing_menu["_id"]},
                {"$push": {"items": {"$each": new_items}}}
            )
        
        updated_menu = await menus_collection.find_one({"_id": existing_menu["_id"]})
        # Convert ObjectId to string manually
        updated_menu["id"] = str(updated_menu.pop("_id"))
        # Convert item IDs too
        for item in updated_menu.get("items", []):
            if "_id" in item:
                item["id"] = str(item.pop("_id"))
        return updated_menu
    else:
        # Create new menu
        result = await menus_collection.insert_one(menu_dict)
        created_menu = await menus_collection.find_one({"_id": result.inserted_id})
        # Convert ObjectId to string manually
        created_menu["id"] = str(created_menu.pop("_id"))
        # Convert item IDs too
        for item in created_menu.get("items", []):
            if "_id" in item:
                item["id"] = str(item.pop("_id"))
        return created_menu

@app.get("/api/menu/{company_id}/{date}")
async def get_menu(company_id: str, date: str):
    """Get menu for a specific company and date"""
    if not ObjectId.is_valid(company_id):
        raise HTTPException(status_code=400, detail="Invalid company ID")
    
    menu = await menus_collection.find_one({
        "company_id": company_id,
        "date": date
    })
    
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found for this date")
    
    # Convert ObjectId to string manually
    menu["id"] = str(menu.pop("_id"))
    # Convert item IDs too
    for item in menu.get("items", []):
        if "_id" in item:
            item["id"] = str(item.pop("_id"))
    
    return menu

@app.get("/api/menus/{company_id}")
async def get_company_menus(company_id: str, limit: int = 30, admin: str = Depends(verify_admin_session)):
    """Get recent menus for a company"""
    if not ObjectId.is_valid(company_id):
        raise HTTPException(status_code=400, detail="Invalid company ID")
    
    menus = []
    async for menu in menus_collection.find(
        {"company_id": company_id}
    ).sort("date", -1).limit(limit):
        # Convert ObjectId to string manually
        menu["id"] = str(menu.pop("_id"))
        # Convert item IDs too
        for item in menu.get("items", []):
            if "_id" in item:
                item["id"] = str(item.pop("_id"))
        menus.append(menu)
    
    return menus

@app.post("/api/menu/{menu_id}/items")
async def add_menu_items(menu_id: str, items: List[MenuItemCreate], admin: str = Depends(verify_admin_session)):
    """Add new items to an existing menu"""
    if not ObjectId.is_valid(menu_id):
        raise HTTPException(status_code=400, detail="Invalid menu ID")
    
    # Verify menu exists
    menu = await menus_collection.find_one({"_id": ObjectId(menu_id)})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    # Convert items to dict and generate IDs
    new_items = []
    for item in items:
        item_dict = item.model_dump()
        item_dict["_id"] = ObjectId()
        new_items.append(item_dict)
    
    # Add items to existing menu
    result = await menus_collection.update_one(
        {"_id": ObjectId(menu_id)},
        {"$push": {"items": {"$each": new_items}}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    # Return updated menu
    updated_menu = await menus_collection.find_one({"_id": ObjectId(menu_id)})
    updated_menu["id"] = str(updated_menu.pop("_id"))
    
    # Convert item IDs
    for item in updated_menu.get("items", []):
        if "_id" in item:
            item["id"] = str(item.pop("_id"))
    
    return updated_menu

@app.put("/api/menu/{menu_id}/items/{item_id}")
async def update_menu_item(menu_id: str, item_id: str, item_update: MenuItemUpdate, admin: str = Depends(verify_admin_session)):
    """Update a specific menu item"""
    if not ObjectId.is_valid(menu_id):
        raise HTTPException(status_code=400, detail="Invalid menu ID")
    
    if not ObjectId.is_valid(item_id):
        raise HTTPException(status_code=400, detail="Invalid item ID")
    
    # Verify menu exists
    menu = await menus_collection.find_one({"_id": ObjectId(menu_id)})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    # Build update data
    update_data = {k: v for k, v in item_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Update specific item in the array
    update_query = {}
    for key, value in update_data.items():
        update_query[f"items.$.{key}"] = value
    
    result = await menus_collection.update_one(
        {"_id": ObjectId(menu_id), "items._id": ObjectId(item_id)},
        {"$set": update_query}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu or item not found")
    
    # Return updated menu
    updated_menu = await menus_collection.find_one({"_id": ObjectId(menu_id)})
    updated_menu["id"] = str(updated_menu.pop("_id"))
    
    # Convert item IDs
    for item in updated_menu.get("items", []):
        if "_id" in item:
            item["id"] = str(item.pop("_id"))
    
    return updated_menu

@app.delete("/api/menu/{menu_id}/items/{item_id}")
async def delete_menu_item(menu_id: str, item_id: str, admin: str = Depends(verify_admin_session)):
    """Delete a specific menu item and its associated ratings"""
    if not ObjectId.is_valid(menu_id):
        raise HTTPException(status_code=400, detail="Invalid menu ID")
    
    if not ObjectId.is_valid(item_id):
        raise HTTPException(status_code=400, detail="Invalid item ID")
    
    # First, delete associated ratings for this menu item
    ratings_result = await ratings_collection.delete_many({
        "menu_id": menu_id,
        "item_id": item_id
    })
    
    # Remove item from menu
    result = await menus_collection.update_one(
        {"_id": ObjectId(menu_id)},
        {"$pull": {"items": {"_id": ObjectId(item_id)}}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    # Check if item was actually removed
    updated_menu = await menus_collection.find_one({"_id": ObjectId(menu_id)})
    
    return {
        "message": "Menu item and associated ratings deleted successfully",
        "menu_id": menu_id,
        "item_id": item_id,
        "remaining_items": len(updated_menu.get("items", [])),
        "deleted_ratings": ratings_result.deleted_count
    }

@app.delete("/api/menu/{menu_id}")
async def delete_menu(menu_id: str, admin: str = Depends(verify_admin_session)):
    """Delete an entire menu"""
    if not ObjectId.is_valid(menu_id):
        raise HTTPException(status_code=400, detail="Invalid menu ID")
    
    # Get menu info before deletion
    menu = await menus_collection.find_one({"_id": ObjectId(menu_id)})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    # Delete associated ratings first
    ratings_result = await ratings_collection.delete_many({"menu_id": menu_id})
    
    # Delete the menu
    menu_result = await menus_collection.delete_one({"_id": ObjectId(menu_id)})
    
    return {
        "message": "Menu deleted successfully",
        "menu_id": menu_id,
        "date": menu.get("date"),
        "deleted_counts": {
            "menu": menu_result.deleted_count,
            "ratings": ratings_result.deleted_count
        }
    }

# Rating Submission Endpoint
@app.post("/api/ratings")
async def submit_ratings(rating_submission: RatingSubmission):
    """Submit ratings for menu items"""
    if not ObjectId.is_valid(rating_submission.company_id):
        raise HTTPException(status_code=400, detail="Invalid company ID")
    
    if not ObjectId.is_valid(rating_submission.menu_id):
        raise HTTPException(status_code=400, detail="Invalid menu ID")
    
    # Verify menu exists
    menu = await menus_collection.find_one({"_id": ObjectId(rating_submission.menu_id)})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    # Create submission record
    today = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Get next employee counter for today
    last_submission = await submissions_collection.find_one(
        {"company_id": rating_submission.company_id, "date": today},
        sort=[("employee_counter", -1)]
    )
    
    next_counter = 1 if not last_submission else last_submission["employee_counter"] + 1
    
    # Create submission
    submission_dict = {
        "company_id": rating_submission.company_id,
        "date": today,
        "employee_counter": next_counter,
        "timestamp": datetime.utcnow(),
        "ratings_count": len(rating_submission.ratings)
    }
    
    submission_result = await submissions_collection.insert_one(submission_dict)
    submission_id = str(submission_result.inserted_id)
    
    # Create individual rating records
    ratings_to_insert = []
    for rating_data in rating_submission.ratings:
        rating_dict = {
            "company_id": rating_submission.company_id,
            "menu_id": rating_submission.menu_id,
            "item_id": rating_data["item_id"],
            "item_name": rating_data["item_name"],
            "score": rating_data["score"],
            "timestamp": datetime.utcnow(),
            "submission_id": submission_id
        }
        ratings_to_insert.append(rating_dict)
    
    if ratings_to_insert:
        await ratings_collection.insert_many(ratings_to_insert)
    
    return {
        "message": "Ratings submitted successfully",
        "submission_id": submission_id,
        "employee_number": next_counter,
        "ratings_count": len(rating_submission.ratings)
    }

# Analytics Endpoints
@app.get("/api/analytics/{company_id}")
async def get_analytics(
    company_id: str, 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None,
    period: str = "daily",  # daily, weekly, monthly
    admin: str = Depends(verify_admin_session)
):
    """Get analytics for a company"""
    if not ObjectId.is_valid(company_id):
        raise HTTPException(status_code=400, detail="Invalid company ID")
    
    # Set default date range if not provided
    if not end_date:
        end_date = datetime.utcnow().strftime("%Y-%m-%d")
    
    if not start_date:
        if period == "daily":
            start_date = end_date
        elif period == "weekly":
            start_dt = datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=7)
            start_date = start_dt.strftime("%Y-%m-%d")
        else:  # monthly
            start_dt = datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=30)
            start_date = start_dt.strftime("%Y-%m-%d")
    
    # Get submissions in date range
    submissions = await submissions_collection.count_documents({
        "company_id": company_id,
        "date": {"$gte": start_date, "$lte": end_date}
    })
    
    # Get ratings in date range
    start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
    end_datetime = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
    
    ratings_cursor = ratings_collection.find({
        "company_id": company_id,
        "timestamp": {"$gte": start_datetime, "$lt": end_datetime}
    })
    
    # Process ratings
    ratings = []
    async for rating in ratings_cursor:
        ratings.append(rating)
    
    if not ratings:
        return AnalyticsResponse(
            company_id=company_id,
            date_range=f"{start_date} to {end_date}",
            total_submissions=submissions,
            average_rating=0.0,
            item_ratings=[],
            best_dish=None,
            worst_dish=None
        )
    
    # Calculate analytics
    total_score = sum(r["score"] for r in ratings)
    average_rating = total_score / len(ratings) if ratings else 0
    
    # Group by item
    item_stats = defaultdict(lambda: {"scores": [], "count": 0, "total": 0})
    
    for rating in ratings:
        item_name = rating["item_name"]
        item_stats[item_name]["scores"].append(rating["score"])
        item_stats[item_name]["count"] += 1
        item_stats[item_name]["total"] += rating["score"]
    
    # Calculate item averages
    item_ratings = []
    for item_name, stats in item_stats.items():
        avg_score = stats["total"] / stats["count"]
        item_ratings.append({
            "item_name": item_name,
            "average_rating": round(avg_score, 2),
            "total_ratings": stats["count"]
        })
    
    # Sort by average rating
    item_ratings.sort(key=lambda x: x["average_rating"], reverse=True)
    
    best_dish = item_ratings[0] if item_ratings else None
    worst_dish = item_ratings[-1] if item_ratings else None
    
    return AnalyticsResponse(
        company_id=company_id,
        date_range=f"{start_date} to {end_date}",
        total_submissions=submissions,
        average_rating=round(average_rating, 2),
        item_ratings=item_ratings,
        best_dish=best_dish,
        worst_dish=worst_dish
    )

# Frontend Routes
@app.get("/admin/login", response_class=HTMLResponse)
async def admin_login_page(request: Request):
    """Admin login page"""
    return templates.TemplateResponse("admin_login.html", {
        "request": request
    })

@app.post("/admin/login")
async def admin_login(request: Request, username: str = Form(...), password: str = Form(...)):
    """Handle admin login"""
    if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
        return templates.TemplateResponse("admin_login.html", {
            "request": request,
            "error": "Invalid username or password"
        })
    
    # Create session token
    session_token = create_session_token(username)
    active_sessions.add(session_token)
    
    # Redirect to admin dashboard with session cookie
    response = RedirectResponse(url="/admin", status_code=302)
    response.set_cookie(
        key="admin_session",
        value=session_token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax"
    )
    return response

@app.post("/admin/logout")
async def admin_logout(session_token: str = Cookie(None, alias="admin_session")):
    """Handle admin logout"""
    if session_token:
        active_sessions.discard(session_token)
    
    response = RedirectResponse(url="/", status_code=302)
    response.delete_cookie("admin_session")
    return response

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Home page with company selection"""
    companies = []
    async for company in companies_collection.find():
        # Convert ObjectId to string for template
        company["id"] = str(company.pop("_id"))
        if "created_at" in company:
            company["created_at"] = company["created_at"].isoformat()
        companies.append(company)
    
    return templates.TemplateResponse("index.html", {
        "request": request,
        "companies": companies
    })

@app.get("/kiosk/{company_id}", response_class=HTMLResponse)
async def kiosk_interface(request: Request, company_id: str):
    """Kiosk interface for rating food items"""
    if not ObjectId.is_valid(company_id):
        raise HTTPException(status_code=400, detail="Invalid company ID")
    
    # Get company details
    company = await companies_collection.find_one({"_id": ObjectId(company_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get today's menu
    today = datetime.utcnow().strftime("%Y-%m-%d")
    menu = await menus_collection.find_one({
        "company_id": company_id,
        "date": today
    })
    
    if not menu:
        # Convert company for template
        company["id"] = str(company.pop("_id"))
        if "created_at" in company:
            company["created_at"] = company["created_at"].isoformat()
        return templates.TemplateResponse("no_menu.html", {
            "request": request,
            "company": company,
            "date": today
        })
    
    # Convert ObjectIds to strings for JSON serialization
    company["id"] = str(company.pop("_id"))
    menu["id"] = str(menu.pop("_id"))
    
    # Convert datetime to string
    if "created_at" in company:
        company["created_at"] = company["created_at"].isoformat()
    if "created_at" in menu:
        menu["created_at"] = menu["created_at"].isoformat()
    
    # Convert item IDs too
    for item in menu.get("items", []):
        if "_id" in item:
            item["id"] = str(item.pop("_id"))
    
    # Create JSON-safe menu items for JavaScript
    import json
    menu_items_json = json.dumps(menu.get("items", []))
    
    # Pass items directly to avoid method confusion
    return templates.TemplateResponse("kiosk_simple.html", {
        "request": request,
        "company": {
            "id": company["id"],
            "name": company["name"], 
            "type": company["type"]
        },
        "menu": {
            "id": menu["id"]
        },
        "menu_items": menu.get("items", [])
    })

@app.get("/admin", response_class=HTMLResponse)
async def admin_dashboard(request: Request, session_token: str = Cookie(None, alias="admin_session")):
    """Admin dashboard"""
    # Check if user is authenticated
    if not session_token or session_token not in active_sessions:
        return RedirectResponse(url="/admin/login", status_code=302)
    
    return templates.TemplateResponse("admin.html", {
        "request": request
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 