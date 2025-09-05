# Review System API Documentation

## Overview

The ConcertMaster Review System provides comprehensive REST APIs for managing reviews, ratings, comments, and feedback for various system entities including workflows, forms, nodes, integrations, and executions.

## Base URL

```
/api/v1/reviews
```

## Authentication

All endpoints require authentication via JWT Bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Entities

The review system supports reviews for the following entity types:
- `workflow` - Workflow definitions and templates
- `form` - Form configurations and templates  
- `node` - Individual workflow nodes
- `integration` - Third-party integrations
- `execution` - Workflow execution instances

## API Endpoints

### Reviews

#### Create Review
```http
POST /api/v1/reviews/
```

Create a new review with optional detailed ratings.

**Request Body:**
```json
{
  "title": "Great workflow for data processing",
  "content": "This workflow is excellent for batch data processing. Easy to use and very reliable.",
  "entity_type": "workflow",
  "entity_id": "550e8400-e29b-41d4-a716-446655440000",
  "overall_rating": 4.5,
  "ratings": [
    {
      "rating_type": "usability",
      "value": 5.0,
      "comment": "Very user-friendly interface"
    },
    {
      "rating_type": "performance", 
      "value": 4.0,
      "comment": "Good performance but could be faster"
    }
  ],
  "tags": ["data-processing", "reliable", "easy"],
  "metadata": {
    "version": "1.2.0",
    "environment": "production"
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Great workflow for data processing",
  "content": "This workflow is excellent for batch data processing...",
  "entity_type": "workflow",
  "entity_id": "550e8400-e29b-41d4-a716-446655440000",
  "author_id": "user-uuid",
  "author_name": "John Doe",
  "status": "published",
  "is_verified": false,
  "overall_rating": 4.5,
  "helpful_count": 0,
  "unhelpful_count": 0,
  "helpfulness_score": 0.0,
  "total_votes": 0,
  "tags": ["data-processing", "reliable", "easy"],
  "metadata": {"version": "1.2.0", "environment": "production"},
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z",
  "published_at": "2024-01-15T10:30:00Z",
  "ratings": [...],
  "comments": [],
  "rating_breakdown": {
    "usability": 5.0,
    "performance": 4.0
  },
  "comment_count": 0
}
```

#### Get Review
```http
GET /api/v1/reviews/{review_id}
```

Retrieve a specific review by ID.

**Query Parameters:**
- `include_deleted` (boolean, admin only) - Include deleted comments

**Response:** `200 OK`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Great workflow for data processing",
  ...
}
```

#### Update Review
```http
PUT /api/v1/reviews/{review_id}
```

Update a review (only by the author).

**Request Body:**
```json
{
  "title": "Updated title",
  "content": "Updated content", 
  "overall_rating": 5.0,
  "status": "published",
  "tags": ["updated", "excellent"],
  "metadata": {"version": "1.3.0"}
}
```

**Response:** `200 OK` - Updated review object

#### Delete Review
```http
DELETE /api/v1/reviews/{review_id}
```

Soft delete a review (archives it). Only the author can delete their own reviews.

**Response:** `204 No Content`

#### List Reviews
```http
GET /api/v1/reviews/
```

List reviews with filtering, searching, and pagination.

**Query Parameters:**
- `page` (int) - Page number (default: 1)
- `per_page` (int) - Items per page (1-100, default: 20)
- `sort` (string) - Sort order: `newest`, `oldest`, `highest_rated`, `lowest_rated`, `most_helpful`, `most_comments`
- `entity_type` (string) - Filter by entity type
- `entity_id` (UUID) - Filter by specific entity
- `author_id` (UUID) - Filter by author
- `status` (string) - Filter by status (default: published only)
- `min_rating` (float) - Minimum rating filter (1.0-5.0)
- `max_rating` (float) - Maximum rating filter (1.0-5.0) 
- `is_verified` (boolean) - Filter by verified reviewers
- `tags` (array) - Filter by tags
- `search_query` (string) - Search in title and content
- `date_from` (datetime) - Filter reviews after this date
- `date_to` (datetime) - Filter reviews before this date

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": "review-uuid",
      "title": "Review title",
      ...
    }
  ],
  "total": 150,
  "page": 1,
  "per_page": 20,
  "pages": 8,
  "has_next": true,
  "has_prev": false
}
```

### Voting

#### Vote on Review
```http
POST /api/v1/reviews/{review_id}/vote
```

Vote on whether a review is helpful or not.

**Request Body:**
```json
{
  "is_helpful": true
}
```

**Response:** `201 Created`
```json
{
  "message": "Vote recorded successfully"
}
```

### Comments

#### Add Comment
```http
POST /api/v1/reviews/{review_id}/comments
```

Add a comment to a review.

**Request Body:**
```json
{
  "content": "Great review! This workflow has been very helpful in our organization.",
  "parent_comment_id": null
}
```

For replies to existing comments, include the `parent_comment_id`:
```json
{
  "content": "I agree! We've had similar experiences.",
  "parent_comment_id": "parent-comment-uuid"
}
```

**Response:** `201 Created`
```json
{
  "id": "comment-uuid",
  "content": "Great review! This workflow has been very helpful...",
  "author_id": "user-uuid",
  "author_name": "Jane Smith",
  "parent_comment_id": null,
  "is_deleted": false,
  "is_flagged": false,
  "upvotes": 0,
  "downvotes": 0,
  "score": 0,
  "created_at": "2024-01-15T11:00:00Z",
  "updated_at": "2024-01-15T11:00:00Z",
  "replies": []
}
```

#### Vote on Comment
```http
POST /api/v1/reviews/comments/{comment_id}/vote
```

Vote on a comment (upvote or downvote).

**Request Body:**
```json
{
  "is_upvote": true
}
```

**Response:** `201 Created`
```json
{
  "message": "Vote recorded successfully"
}
```

### Entity Summaries

#### Get Entity Summary
```http
GET /api/v1/reviews/entities/{entity_type}/{entity_id}/summary
```

Get aggregated review statistics for an entity.

**Response:** `200 OK`
```json
{
  "entity_type": "workflow",
  "entity_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_reviews": 25,
  "average_rating": 4.2,
  "rating_distribution": {
    "1": 1,
    "2": 2,
    "3": 5,
    "4": 8,
    "5": 9
  },
  "average_usability": 4.5,
  "average_performance": 3.8,
  "average_reliability": 4.3,
  "average_design": 4.0,
  "total_comments": 45,
  "total_votes": 120,
  "last_updated": "2024-01-15T12:00:00Z"
}
```

### Trending & Analytics

#### Get Trending Reviews
```http
GET /api/v1/reviews/trending
```

Get trending reviews based on recent engagement.

**Query Parameters:**
- `days` (int) - Days to look back (1-30, default: 7)
- `limit` (int) - Maximum results (1-50, default: 10)

**Response:** `200 OK`
```json
[
  {
    "id": "trending-review-uuid",
    "title": "Trending review title",
    "overall_rating": 4.8,
    "helpful_count": 25,
    ...
  }
]
```

#### Get User Reviews
```http
GET /api/v1/reviews/users/{user_id}/reviews
```

Get all reviews by a specific user.

**Query Parameters:**
- `include_drafts` (boolean) - Include draft reviews (only for own reviews or admin)

**Response:** `200 OK`
```json
[
  {
    "id": "user-review-uuid",
    "title": "User's review",
    ...
  }
]
```

### Admin Endpoints

#### Bulk Operations
```http
POST /api/v1/reviews/bulk
```

Perform bulk operations on reviews (admin only).

**Request Body:**
```json
{
  "review_ids": ["uuid1", "uuid2", "uuid3"],
  "action": "archive",
  "reason": "Bulk archival for cleanup"
}
```

Actions: `archive`, `delete`, `flag`, `unflag`

**Response:** `200 OK`
```json
{
  "success_count": 2,
  "failed_count": 1,
  "failed_items": [
    {
      "id": "uuid3",
      "error": "Review not found"
    }
  ]
}
```

#### Analytics
```http
GET /api/v1/reviews/analytics
```

Get comprehensive review analytics (admin only).

**Query Parameters:**
- `entity_type` (string) - Filter by entity type
- `days` (int) - Analysis period (1-365, default: 30)

**Response:** `200 OK`
```json
{
  "total_reviews": 1250,
  "average_rating": 4.1,
  "rating_trend": [
    {
      "date": "2024-01-01",
      "average": 4.0,
      "count": 15
    }
  ],
  "top_reviewers": [
    {
      "user_id": "user-uuid",
      "name": "Top Reviewer",
      "review_count": 25,
      "average_helpfulness": 0.85
    }
  ],
  "popular_entities": [
    {
      "entity_type": "workflow",
      "entity_id": "entity-uuid",
      "review_count": 50,
      "average_rating": 4.5
    }
  ],
  "engagement_metrics": {
    "total_votes": 5000,
    "total_comments": 2500,
    "average_comments_per_review": 2.0
  }
}
```

## Data Models

### Review
- `id` - UUID primary key
- `title` - Review title (3-255 chars)
- `content` - Review content (10-10000 chars)
- `entity_type` - Type of entity being reviewed
- `entity_id` - UUID of the entity
- `author_id` - UUID of the review author
- `author_name` - Name of the author (denormalized)
- `status` - Review status (draft/published/archived/flagged)
- `is_verified` - Whether the reviewer is verified
- `overall_rating` - Overall rating (1.0-5.0)
- `helpful_count` - Number of helpful votes
- `unhelpful_count` - Number of not helpful votes
- `tags` - Array of tags
- `metadata` - Additional metadata object
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `published_at` - Publication timestamp

### Rating
- `id` - UUID primary key
- `review_id` - Foreign key to review
- `rating_type` - Type of rating (usability/performance/reliability/design)
- `value` - Rating value (1.0-5.0)
- `comment` - Optional explanation

### Comment
- `id` - UUID primary key
- `review_id` - Foreign key to review
- `parent_comment_id` - For threaded replies
- `content` - Comment content (3-2000 chars)
- `author_id` - UUID of comment author
- `author_name` - Name of the author (denormalized)
- `is_deleted` - Soft delete flag
- `is_flagged` - Moderation flag
- `upvotes` - Number of upvotes
- `downvotes` - Number of downvotes

## Error Handling

### Error Response Format
```json
{
  "detail": "Error message describing what went wrong"
}
```

### Common Status Codes
- `200` - Success
- `201` - Created successfully  
- `204` - No content (successful deletion)
- `400` - Bad request (validation error)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `422` - Unprocessable entity (validation failed)
- `500` - Internal server error

### Validation Rules
- Review title: 3-255 characters
- Review content: 10-10,000 characters
- Rating values: 1.0-5.0 (decimal)
- Comment content: 3-2,000 characters
- Tags: Maximum 10 unique tags per review
- Search query: Maximum 100 characters

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- Standard endpoints: 100 requests per minute per user
- Vote endpoints: 50 requests per minute per user
- Admin endpoints: 200 requests per minute per admin

## Pagination

List endpoints support pagination:
- Default page size: 20 items
- Maximum page size: 100 items
- Page numbering starts at 1

## Search

The search functionality supports:
- Full-text search in review titles and content
- Tag-based filtering
- Rating range filtering
- Date range filtering
- Entity-based filtering
- Author-based filtering

## Security Features

- JWT-based authentication
- Role-based authorization
- Rate limiting protection
- SQL injection prevention
- Input validation and sanitization
- CORS configuration
- Audit logging for admin operations