# **AssetWise - Server Side**

**AssetWise** Server Side handles the backend of the asset management system, providing essential APIs to support HR Managers and Employees in managing assets. This backend ensures the secure handling of user authentication, asset management, request processing, and analytics.

## Key Features of AssetWise

- **Subscription-Based Model**: Companies can subscribe to the platform for efficient asset and product management.
- **Role-Based Access**: Separate access levels for HR Managers and Employees to ensure tailored permissions and features.
- **Asset Categorization**: Assets are categorized as Returnable (e.g., laptops) and Non-Returnable (e.g., diaries) for easy management.
- **HR Manager Controls**: HR Managers can add, update, and manage assets, and assign them to employees.
- **Employee Dashboard**: Employees can view their assigned assets, request new ones, and track asset availability.
- **Request Management**: Employees can submit requests for assets, while HR Managers can approve or reject them.
- **Payment Integration**: Supports subscription payments via **Stripe**, allowing seamless onboarding for companies.
- **Analytics and Insights**: Visual reports and metrics for HR Managers to track asset usage and trends.
- **Team Management**: Employees can be grouped into teams, allowing HR Managers to manage asset allocation on a team basis.
- **Secure Authentication**: Users are authenticated using **JWT** (JSON Web Token), ensuring secure access and sessions.

---

### Live Site
- [https://assetwise-b85cb.web.app](https://assetwise-b85cb.web.app)

### Technologies Used
- **Node.js**: For building the backend server.
- **Express.js**: A lightweight framework to handle API routes and middleware.
- **MongoDB**: NoSQL database for storing user, asset, and request data.
- **JWT (JSON Web Token)**: For secure user authentication and session management.
- **CORS**: To handle Cross-Origin Resource Sharing issues between the frontend and backend.
- **Moment.js**: For handling date/time data.
- **dotenv**: For managing environment variables securely.
- **Morgan**: HTTP request logger middleware for logging incoming requests.
- **Stripe**: For payment handling and subscription management.
- **Body-Parser**: To parse incoming request bodies.
