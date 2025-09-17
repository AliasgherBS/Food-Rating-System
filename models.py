from pydantic import BaseModel, Field, GetJsonSchemaHandler
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema
from typing import List, Optional, Any
from datetime import datetime
from enum import Enum
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler: GetJsonSchemaHandler
    ) -> core_schema.CoreSchema:
        return core_schema.no_info_plain_validator_function(
            cls.validate,
            serialization=core_schema.to_string_ser_schema()
        )

    @classmethod
    def validate(cls, v):
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str) and ObjectId.is_valid(v):
            return ObjectId(v)
        raise ValueError("Invalid ObjectId")

    @classmethod
    def __get_pydantic_json_schema__(
        cls, core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        return {"type": "string"}

class CompanyType(str, Enum):
    STATIC = "static"
    CAFETERIA = "cafeteria"

class Company(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    name: str
    type: CompanyType
    created_at: datetime = Field(default_factory=datetime.now)
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str}
    }
    
    def to_dict(self):
        data = self.model_dump()
        if "_id" in data:
            data["id"] = str(data.pop("_id"))
        return data

class MenuItem(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    name: str
    description: Optional[str] = ""
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str}
    }
    
    def to_dict(self):
        data = self.model_dump()
        if "_id" in data:
            data["id"] = str(data.pop("_id"))
        return data

class Menu(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    company_id: str
    date: str  # YYYY-MM-DD format
    items: List[MenuItem]
    created_at: datetime = Field(default_factory=datetime.now)
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str}
    }
    
    def to_dict(self):
        data = self.model_dump()
        if "_id" in data:
            data["id"] = str(data.pop("_id"))
        # Also convert nested MenuItem IDs
        if "items" in data:
            for item in data["items"]:
                if "_id" in item:
                    item["id"] = str(item.pop("_id"))
        return data

class Rating(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    company_id: str
    menu_id: str
    item_id: str
    item_name: str
    score: int  # 0-5 scale
    timestamp: datetime = Field(default_factory=datetime.now)
    submission_id: str
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str}
    }

class Submission(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    company_id: str
    date: str  # YYYY-MM-DD format
    employee_counter: int
    timestamp: datetime = Field(default_factory=datetime.now)
    ratings_count: int = 0
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str}
    }

# Request/Response Models
class CompanyCreate(BaseModel):
    name: str
    type: CompanyType

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[CompanyType] = None

class MenuCreate(BaseModel):
    company_id: str
    date: str
    items: List[MenuItem]

class MenuItemCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class RatingSubmission(BaseModel):
    company_id: str
    menu_id: str
    ratings: List[dict]  # [{"item_id": str, "item_name": str, "score": int}]

class AnalyticsResponse(BaseModel):
    company_id: str
    date_range: str
    total_submissions: int
    average_rating: float
    item_ratings: List[dict]
    best_dish: Optional[dict] = None
    worst_dish: Optional[dict] = None 