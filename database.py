import motor.motor_asyncio
from typing import Optional
import os

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://alihuzezzy:1UMkpXpBSnjYQzpd@cluster0.iw6ndin.mongodb.net/")
DATABASE_NAME = "food_deck_rating"

client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
database = client[DATABASE_NAME]

# Collections
companies_collection = database.companies
menus_collection = database.menus
ratings_collection = database.ratings
submissions_collection = database.submissions

async def ping_database():
    """Test database connection"""
    try:
        await client.admin.command('ping')
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False

def get_database():
    """Get database instance"""
    return database 