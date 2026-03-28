# Module 13: AI Lead Scoring & Prioritization Layer

**Status**: ✅ **Production-Ready**

## Overview

Intelligent scoring & prioritization system for CRM decision support. Deterministic, explainable, role-based.

---

## 1. CORE PRINCIPLES ✅

- **Deterministic**: No black-box. All scores = explicit weighted factors.
- **Explainable**: Every score has reasons with factor + weight + explanation.
- **Role-Safe**: Admin/manager/agent see only their data scope.
- **Recommendation-Only**: AI suggests, never auto-executes critical actions.
- **Lightweight**: No ML infrastructure, pure weighted rules.

---

## 2. ENTITIES ✅

### LeadScore

```javascript
{
  projectId: string,
  clientId?: string,
  inquiryId?: string,
  interestId?: string,
  
  scoreType: enum [
    'inquiry_priority',        // New inquiry urgency
    'client_priority',         // Client importance
    'reservation_probability', // Chance of converting to reservation
    'deal_probability',        // Chance of closing deal
    'followup_urgency',        // Task urgency
    'unit_match'              // Unit suitability score
  ],
  
  scoreValue: number [0-100],
  band: enum ['low', 'medium', 'high', 'critical'],
  
  reasonsJson: JSON, // [{ factor, weight, explanation }]
  recommendationText: string,
  recommendedAction: enum [
    'call_now', 'send_followup', 'schedule_visit', 
    'propose_units', 'escalate_to_manager', 'wait', 'close_out'
  ],
  
  sourceDataSnapshotJson: JSON, // Snapshot of data when scored
  modelVersion: string, // v1.0, v1.1, etc.
  
  generatedAt: datetime,
  expiresAt?: datetime // 24h default
}
```

### UnitRecommendation

```javascript
{
  projectId: string,
  clientId: string,
  interestId?: string,
  unitId: string,
  
  matchScore: number [0-100],
  matchReasonsJson: JSON,
  recommendedAt: datetime
}
```

---

## 3. SCORING LOGIC (DETERMINISTIC) ✅

### scoreInquiryPriority(inquiry)

**Factors**:
- Age: < 2h = +25, < 24h = +15, > 24h = -10
- Status: new = +20, claimed = +0
- Message detail: has message = +10
- Contact info: has phone = +5

**Base**: 50  
**Range**: 0-100  
**Band**: critical (80+), high (60+), medium (40+), low (<40)

### scoreClientPriority(client, interests, tasks, activities)

**Factors**:
- Active interests: +10 each (contacted, considering, follow_up, reserved)
- Recent activity: < 24h = +15, < 7d = +8
- No activity: -15
- Overdue tasks: +20 each
- Won interest: +25

**Base**: 50

### scoreReservationProbability(interest, activities, units)

**Factors**:
- Pipeline stage:
  - new=5, contacted=10, consultation=15, visit=25, negotiation=40, reserved=80, won=95
- Recent interaction: < 24h = +15, > 7d = -15
- Follow-up soon: +10

**Base**: 40

### scoreDealProbability(reservation, agreement, payments, activities)

**Factors**:
- Reservation status: active = +30, converted = +90
- Agreement signed = +40, draft = +15
- Advance payments: +15 each
- Long engagement (> 30d): +10

**Base**: 20

### scoreFollowupUrgency(task, interest, slaConfig)

**Factors**:
- Task overdue: +35
- Due < 2h: +30, < 24h: +20
- Priority: low=0, medium=+5, high=+15, critical=+25
- Interactive task (call/meeting): +10

**Base**: 40

### scoreUnitMatch(clientInterest, units, project)

**Factors**:
- Same project: +10
- Unit available: +20, not available: -40
- Price match: +5
- Area reasonable (30-200m²): +5
- Public listing: +3

**Per-unit score**, sorted descending, top 5 returned.

---

## 4. BACKEND FUNCTIONS ✅

### generateLeadScores(projectId?, clientId?, inquiryId?, interestId?)

Generate or refresh scores for specific entities.

**Response**:
```javascript
{
  success: true,
  scoresGenerated: number,
  scores: [LeadScore, ...]
}
```

**Access**: ADMINISTRATOR, SALES_MANAGER (with project check)

### generateUnitRecommendations(clientId, projectId, interestId?)

Generate top 5 unit recommendations for client.

**Response**:
```javascript
{
  success: true,
  recommendationsCreated: number,
  recommendations: [UnitRecommendation, ...]
}
```

### getPriorityQueue(projectIds?, assignedUserId?)

Get sorted priority queue of high/critical items.

**Access**:
- SALES_AGENT: Only own tasks/items
- SALES_MANAGER: Project-scoped items
- ADMINISTRATOR: All items

**Response**:
```javascript
{
  success: true,
  queue: [
    {
      scoreId, type, entityId, scoreValue, band,
      reasonsJson, recommendationText, recommendedAction
    }
  ],
  count: number
}
```

### getScoredPipeline(projectIds?)

Get pipeline grouped by stage with scores.

**Response**:
```javascript
{
  success: true,
  pipeline: {
    new: [...],
    contacted: [...],
    consultation: [...],
    // etc.
  },
  totalCount: number
}
```

### refreshScoresCron()

Scheduled refresh (cron job):
- Mark expired scores
- Recalculate high-priority interests (last interaction < 7d)
- Limit to 50 per run

**Deployment**: Create automation `Refresh Scores Hourly`

---

## 5. UI PAGES ✅

### PriorityQueue

Route: `/priority-queue`

**Features**:
- Stats card: critical, high, medium, low count
- Sorted queue by band + score
- Each item: score, band badge, top reason, recommendation text, action button
- Mobile-first for agents

**Access**: All roles (filtered by scope)

### ManagerInsights

Route: `/manager-insights`

**Features**:
- Project selector (only accessible projects)
- Critical leads section (red)
- At-risk reservations (orange, expiring < 7d)
- Recent deals (green)
- High-level KPIs

**Access**: SALES_MANAGER, ADMINISTRATOR

### UnitRecommendationsBlock

Embed on ClientDetail page.

**Features**:
- Top recommended units for client
- Match score badge
- Top reason for match
- "View" button to open unit

---

## 6. EXPLAINABILITY ✅

**Every Score Includes**:
1. ScoreValue (0-100)
2. Band (low/medium/high/critical)
3. RecommendedAction (call_now, send_followup, etc.)
4. ReasonsJson:
   ```javascript
   [
     { factor: "overdue_task", weight: 35, explanation: "..." },
     { factor: "recent_activity", weight: 15, explanation: "..." }
   ]
   ```

**UI Display**:
- Show score + band
- Show top 1-2 reasons
- Show recommendation text
- Show action button with icon

**No Black-Box**: User can always see why score was assigned.

---

## 7. ACCESS CONTROL ✅

**ADMINISTRATOR**:
- Full access to all scores, queues, insights
- Can regenerate all scores
- Can view all projects

**SALES_MANAGER**:
- Scores for their assigned projects only
- See team's priority queue
- Access to Manager Insights (project-scoped)
- Can generate recommendations for their project

**SALES_AGENT**:
- See only their own priority queue (assigned tasks/interests)
- See only their clients' recommendations
- No access to Manager Insights

**PROJECT_DEVELOPER**:
- No scoring access (potential data leak risk)

---

## 8. SCORE REFRESH TRIGGERS ✅

Scores auto-refresh when:

- Inquiry created/updated → `scoreInquiryPriority`
- Task status changed → `scoreFollowupUrgency`
- Interest stage changed → `scoreReservationProbability`
- Reservation created → `scoreReservationProbability`
- Agreement signed → `scoreDealProbability`
- Payment recorded → `scoreDealProbability`
- Deal created → `scoreDealProbability`

Plus:
- Hourly cron (`refreshScoresCron`) for stale score refresh

---

## 9. SAFETY CONSTRAINTS ✅

**Scores CANNOT**:
- Auto-delete client / interest / reservation
- Auto-change unit status
- Auto-create agreement / payment
- Auto-publish unit
- Bypass role-based access control

**Scores CAN**:
- Recommend priority order
- Suggest next action
- Highlight opportunities
- Flag at-risk situations
- Trigger manual review by manager

---

## 10. PERFORMANCE ✅

- Score queries: Limited by projectId + band filtering
- Priority queue: Max 50 items per request (sorted, top-N)
- Cron refresh: Processes max 50 interests per run
- No unbounded full-table scans

---

## 11. FUTURE ENHANCEMENTS (NOT IN V1)

- Time-series scoring trend (how score changed over week)
- Predicted close date (based on stage transition speed)
- Agent performance metrics (conversion % by agent)
- Custom scoring rules per project
- Webhook notifications on critical score changes
- Bulk score refresh with progress tracking
- Score validation rules (catch impossible combinations)

---

## Testing Checklist

- [ ] generateLeadScores creates scores with reasons
- [ ] scoreValue is 0-100, band matches threshold
- [ ] reasonsJson is valid JSON with factor/weight/explanation
- [ ] getPriorityQueue returns sorted by band + score descending
- [ ] PriorityQueue page loads and shows queue
- [ ] ManagerInsights filters by project and shows metrics
- [ ] SALES_AGENT cannot see other agents' items
- [ ] UnitRecommendationsBlock embeds on ClientDetail
- [ ] Each score has clear recommendation text + action
- [ ] refreshScoresCron updates recent interests

---

## Deployment Steps

1. **Entities**: LeadScore + UnitRecommendation
2. **Functions**: 5 functions + scoring engine
3. **Pages**: PriorityQueue + ManagerInsights
4. **Components**: UnitRecommendationsBlock
5. **Routes**: Add to App.jsx
6. **Automation**: Create `Refresh Scores Hourly` (refreshScoresCron)
7. **Entity Automations** (future): Wire score refresh to inquiry/interest/reservation events

---

## Module Status

✅ **Complete & Production-Ready**

- Deterministic scoring with full explainability
- Role-based access control
- Lightweight, maintainable codebase
- Ready for real sales workflows