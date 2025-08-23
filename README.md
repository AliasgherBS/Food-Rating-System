# Food Deck Rating System

A modern, responsive web application for collecting and analyzing food ratings in corporate cafeterias and static meal services.

## Features

### 🍽️ Kiosk Interface
- **Touch-friendly design** for easy employee interaction
- **Smart rating system** with emoji-based scoring (1-5 stars)
- **Cafeteria mode** with item selection checkboxes
- **Static mode** for fixed meal services
- **Real-time feedback** with visual confirmations

### 🔧 Admin Dashboard
- **Secure admin access** with username/password authentication (admin/admin)
- **Company management** - Add, edit, and delete companies
- **Menu management** - Create daily menus with multiple items
- **Advanced menu editing** - Add items to existing menus, edit individual items
- **Analytics dashboard** with comprehensive insights
- **Rating analytics** - View performance metrics by item and time period

### 📊 Analytics & Reporting
- **Real-time analytics** with daily, weekly, and monthly views
- **Item performance tracking** with detailed rating breakdowns
- **Best/worst dish identification** for menu optimization
- **Submission tracking** to monitor participation rates

### 🔒 Security
- **Basic HTTP authentication** for all admin endpoints
- **Secure API endpoints** with proper authentication checks
- **Data integrity** with proper cascading deletes

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd food-deck-rating
```

2. **Install dependencies**
```bash
pip install -r requirements.txt
```

3. **Set up MongoDB**
   - Install MongoDB locally or use MongoDB Atlas
   - Update the connection string in `database.py` if needed

4. **Run the application**
```bash
python main.py
```

The application will be available at `http://localhost:8000`

## Usage

### Admin Access
- Navigate to `/admin` to access the admin dashboard
- Use credentials: **username: admin, password: admin**
- Manage companies, menus, and view analytics

### Kiosk Access
- Navigate to `/` to see available companies
- Click on a company to access the rating kiosk
- Rate food items using the intuitive interface

## API Endpoints

### Public Endpoints
- `GET /` - Home page with company selection
- `GET /kiosk/{company_id}` - Kiosk interface for ratings
- `GET /health` - Health check
- `POST /api/ratings` - Submit ratings

### Admin Endpoints (Requires Authentication)
- `GET /admin` - Admin dashboard
- `GET/POST/PUT/DELETE /api/companies` - Company management
- `GET/POST/PUT/DELETE /api/menu/*` - Menu management
- `GET /api/analytics/{company_id}` - Analytics data

## Database Schema

The application uses MongoDB with the following collections:
- **companies** - Company information and settings
- **menus** - Daily menus with items for each company
- **ratings** - Individual rating submissions
- **submissions** - Aggregated submission tracking

## Features in Detail

### Menu Management
- **Create new menus** for specific dates
- **Add multiple items** at once with descriptions
- **Edit existing menus** and individual items
- **Delete menus** with automatic cleanup of associated ratings
- **Prevent data loss** with confirmation dialogs

### Rating System
- **5-star rating scale** with emoji feedback
- **Cafeteria mode**: Select items before rating
- **Static mode**: Rate all available items
- **Anonymous submissions** with employee counter tracking

### Analytics
- **Performance metrics** for individual menu items
- **Time-based filtering** (daily, weekly, monthly)
- **Visual indicators** for rating quality
- **Best/worst dish identification** for menu optimization

## Security Notes

- Admin credentials are currently hardcoded as admin/admin
- In production, use environment variables for credentials
- Consider implementing proper user management and JWT tokens
- All admin endpoints require basic HTTP authentication

## Development

### File Structure
```
├── main.py              # FastAPI application and routes
├── models.py            # Pydantic models and data structures
├── database.py          # MongoDB connection and configuration
├── requirements.txt     # Python dependencies
├── templates/           # Jinja2 HTML templates
│   ├── base.html       # Base template with common layout
│   ├── index.html      # Home page
│   ├── admin.html      # Admin dashboard
│   ├── kiosk_simple.html # Kiosk interface
│   └── no_menu.html    # No menu available page
└── static/             # Static assets
    ├── css/            # Stylesheets
    ├── js/             # JavaScript files
    └── images/         # Image assets
```

### Adding New Features
1. Add new Pydantic models in `models.py`
2. Create API endpoints in `main.py`
3. Add frontend functionality in appropriate JS files
4. Style with CSS in the static directory

## License

This project is licensed under the MIT License. 