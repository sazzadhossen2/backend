# Database design (MongoDB)

## ER diagram

```mermaid
erDiagram
    USER ||--o{ APPOINTMENT : books
    SERVICE ||--o{ APPOINTMENT : "is booked in"
    APPOINTMENT ||--o| REVIEW : "is reviewed by"
    USER ||--o{ REVIEW : writes
    SERVICE ||--o{ REVIEW : receives
    SERVICE ||--o{ BUSYBLOCK : "blocked by (optional)"
    USER ||--o{ BUSYBLOCK : "created by admin"

    USER {
        ObjectId _id PK
        string name
        string email UK
        string password "bcrypt hash, select:false"
        string phone
        string role "user | admin"
        boolean isEmailVerified
    }
    SERVICE {
        ObjectId _id PK
        string name
        string description
        number price "BDT"
        number durationMinutes
        string image
        string category
        boolean isFeatured
        number rating "average of reviews"
        number reviewsCount
        number bookingsCount
        boolean isActive
    }
    APPOINTMENT {
        ObjectId _id PK
        ObjectId user FK
        ObjectId service FK
        date startAt
        date endAt
        string status "pending | confirmed | cancelled | completed"
        string notes
        string adminNote "reason when denied"
        number price "snapshot at booking time"
        string paymentStatus "unpaid | paid | refunded | refund_failed"
        string paymentIntentId "Stripe"
        date paidAt
        boolean reviewed
        boolean isActive "pending or confirmed"
    }
    REVIEW {
        ObjectId _id PK
        ObjectId user FK
        ObjectId service FK
        ObjectId appointment FK,UK
        number rating "1-5"
        string comment
    }
    BUSYBLOCK {
        ObjectId _id PK
        ObjectId service FK "null = all services"
        date startAt
        date endAt
        string reason
        ObjectId createdBy FK
    }
    OTP {
        string email
        string purpose "verify | reset"
        string codeHash "HMAC, never the code"
        number attempts
        date expiresAt "TTL index"
    }
```

## Relationships
- One **User** has many **Appointments**.
- One **Service** has many **Appointments**.
- An **Appointment** belongs to exactly one User and one Service. `price` is copied from the service so later price changes do not alter past bookings.

## Indexes
| Collection | Index | Purpose |
|------------|-------|---------|
| users | `email` unique | one account per email |
| services | `{category, price}`, `{isFeatured, bookingsCount}` | filtering and popular sorting |
| appointments | `{user, startAt}` | "My bookings" |
| appointments | `{service, startAt, endAt}` | overlap queries |
| appointments | `{service, startAt}` **unique, partial (`isActive: true`)** | blocks double booking under concurrency |

## Setup
1. Install MongoDB locally, or create a free MongoDB Atlas cluster.
2. Put the connection string in `.env` as `MONGO_URI`.
3. `npm run seed` creates the collections, indexes (via Mongoose), sample services and the demo/admin accounts.


## New in v2
- **Otp**: one live code per `(email, purpose)`. Stored as an HMAC hash, expires after 10 minutes (MongoDB TTL index), max 5 attempts, 60 s resend cooldown. Not related to other collections.
- **Review**: one per completed appointment (`appointment` is unique). Saving a review recalculates `Service.rating` and `Service.reviewsCount`.
- **BusyBlock**: admin-defined unavailable time. `service = null` blocks every service. Slots overlapping a block are returned with `available:false, reason:"busy"` and cannot be booked.
- **Appointment** gained payment fields (Stripe) and `adminNote`.
- Existing databases: run `npm run seed` once. It marks accounts created before v2 as verified so nobody is locked out.
