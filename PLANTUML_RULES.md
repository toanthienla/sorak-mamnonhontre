# PlantUML Diagram Rules — Sorak (La Thien Toan style)

Single source of truth for drawing **sequence** (`SEQ_*`) and **class** (`CD_*`) diagrams.
Match this exactly. When unsure, copy nearest existing diagram of same kind in
`sprint1-toan-plantuml.txt`.

Theme is **pure black & white**: white backgrounds, black borders, black arrows. No color, no shadow.

---

## 1. Sequence diagrams (`SEQ_*`)

### 1.1 Header (paste verbatim)

```
@startuml SEQ_<Name>
!pragma teoz true

skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam database {
    BackgroundColor #FFFFFF
    BorderColor #000000
}
skinparam sequence {
    ParticipantBackgroundColor #FFFFFF
    ParticipantBorderColor #000000
    ActorBackgroundColor #FFFFFF
    ActorBorderColor #000000
    LifeLineBackgroundColor #FFFFFF
    LifeLineBorderColor #000000
    DatabaseBackgroundColor #FFFFFF
    DatabaseBorderColor #000000
    ArrowColor #000000
    GroupBackgroundColor #FFFFFF
    GroupBodyBackgroundColor #FFFFFF
    GroupBorderColor #000000
}
```

Rules:

- `!pragma teoz true` ONLY when diagram uses `||20|| / ||10||` spacing. Omit for simple flows (e.g. Logout).
- Drop the `skinparam database {...}` block if no `database` participant (e.g. pure middleware refs, Logout).

### 1.2 Participants — fixed order, fixed aliases

```
actor "<Role>" as User
participant "Client Application" as Client
participant ":<Module>Route" as Route
participant ":<Module>Schema" as Valid      ← only if request body/query validated
participant ":<Module>Controller" as Ctrl
participant ":<Module>Service" as Svc
participant "Prisma ORM" as ORM
database "PostgreSQL" as DB
```

- Actor roles used: `Principal`, `Principal / Teacher`, `Parent`, `Principal / Teacher / Parent`.
- Optional extra participants (declare right after the one they sit near):
  - `participant ":EmailService" as Mail` + `participant "SMTP Server" as SMTP`
  - `participant ":StorageService" as Store` + `participant "Cloudinary" as Cloud`
  - `participant ":UploadMiddleware\n(multer)" as Upload`
  - `participant ":AuthMiddleware" as Mid` (when auth done inline, not via REF)
- Layer flow (mirrors backend arch — business logic in Service only):
  `User → Client → Route → Valid → Ctrl → Svc → ORM → DB`.
- Request payload `{ ...fields }` goes on the **Client → Route** endpoint message (it is the HTTP
  body), NOT on the User → Client message. User → Client = the user action only
  (e.g. "Submit create X form").

### 1.3 Numbering

- Global sequential integers: `1.`, `2.`, `3.` … across whole diagram.
- Branch / nested steps use dotted suffix off parent step: `2.1.`, `2.1.1.`, `4.1.`, `8.5.1.`.

### 1.4 Auth block (reusable REF)

```
ref over Route : REF — SEQ_Auth_Principal
```

or `REF — SEQ_Auth_PrincipalOrTeacher`. Immediately follow with:

```
alt Token invalid OR expired OR missing
    Route --> Client : 2.1. 401 Unauthorized
    Client --> User : 2.1.1. Error message
else Role != Principal
    Route --> Client : 2.2. 403 "Chỉ Hiệu trưởng có quyền"
    Client --> User : 2.2.1. Error message
end
```

Role message goes on the `Route --> Client` line, in **Vietnamese** (consistent with all other
user-facing messages): `403 "Chỉ Hiệu trưởng có quyền"` (Principal-only) or
`403 "Chỉ Hiệu trưởng và Giáo viên có quyền"` (PrincipalOrTeacher). `Client --> User` is the
uniform `Error message` (see consistency note under §1.5).

Two standalone REF diagrams exist (`SEQ_Auth_Principal`, `SEQ_Auth_PrincipalOrTeacher`):
Route → `:AuthMiddleware` (verify token) → `:RoleMiddleware` (`requireRoles(...)`), each with an `opt` failure branch.

### 1.5 Validation block

```
Route -> Valid : 3. validate(<schemaName>, 'body')   ← or 'query'
activate Valid
Valid -> Valid ++ : 4. Parse <fields>
||20||
deactivate Valid
||10||
opt Validation fail
    Valid --> Route : 4.1. next(ValidationError)
    Route --> Client : 4.2. 400 VALIDATION_ERROR
    Client --> User : 4.3. Error message
end
Valid --> Route : 5. Passed (next())
deactivate Valid
```

Consistency: ALL error branches — auth alt, validation, and service `opt`s — end with the same
`Client --> User : Error message` line. Descriptive text (incl. role message) goes on the
`Route --> Client` step. Don't use "Redirect to login" / "Show field errors" — use "Error message".

### 1.6 Self-call (internal logic step) — signature idiom

```
Svc -> Svc ++ : N. <do thing>
||20||
deactivate Svc
||10||
```

- `++` activates on the self-message; `deactivate` closes it; `||20||`/`||10||` pad spacing (teoz only).
- On no-teoz diagrams: drop the `||..||` lines, keep `++` / `deactivate`.

### 1.6b Conditional guard + error — keep nested `opt` + self-check

When a check is only run under a precondition (e.g. role-specific, or "only if X resolved"),
wrap it in an OUTER `opt` for the precondition. Inside: run the supporting lookup, then a
`Svc -> Svc ++` self-check, then a nested INNER `opt` holding the throw chain. Keep both opt
levels and the self-check step — do NOT flatten into a single combined `opt`.

```
opt role == TEACHER (BR-057 ownership)
    Svc -> ORM : N. getTeacherClassIds — find teacher + assigned classes
    activate ORM
    ORM -> DB : N.1. Query teacher + teacher_classes
    activate DB
    DB --> ORM : N.2. Return rows
    deactivate DB
    ORM --> Svc : N.3. Return classIds
    deactivate ORM

    Svc -> Svc ++ : N.4. Check fromClassId in own classes
    ||20||
    deactivate Svc
    ||10||

    opt Not own class
        Svc --> Ctrl : N.4.1. throw Forbidden
        Ctrl --> Route : N.4.2. Pass error
        Route --> Client : N.4.3. 403 "<Vietnamese message>"
        Client --> User : N.4.4. Error message
    end
end
```

### 1.6d Every frame-opening `opt` must follow a self-call

An `opt` whose body opens an activation frame must be immediately preceded by a `Svc -> Svc ++`
self-call (the check that decides the branch). Never open such an `opt` directly off a returning
DB/ORM message. If a conditional ORM call (e.g. `applyRequest`) sits in an `opt`, add the deciding
`Svc -> Svc` self-call first, then the `opt` with child numbering (see §1.6c).

This holds **even inside a transaction** — e.g. a conditional `UPDATE account` guarded by
`if (student.account_id)`: insert `Svc -> Svc ++ : N. Check student.account_id present` before the
`opt`, with the ORM/DB tx bars staying active through the self-call, then the opt body
(`N.1 ORM -> DB`, `N.2 OK`, `deactivate DB`).

This also holds for **role-based** opts: an `opt role == TEACHER (...)` must be preceded by
`Svc -> Svc ++ : N. Check role == TEACHER (assertClassAccess)`; the lookup + ownership self-check +
inner error opt then live inside as `N.1 … N.5 …`.

### 1.6c Self-call frame + sub-step opt → child numbering

When a `Svc -> Svc ++` self-call (step N) opens a frame and the `opt` that follows is logically a
sub-step of it, number the opt's content as CHILDREN of N — **flat, single decimal level**:
`N.1`, `N.2`, `N.3`, … (the ORM call, its DB writes, the return all share the `N.` prefix in
sequence). Don't give the sub-step a new top-level integer, and don't add a second decimal level
(`N.1.1`) for the ORM's own DB calls — keep them flat as `N.2`, `N.3`.

Exception: when the opt itself is an ERROR branch off a self-check (throw chain), the error steps
nest one more level (`N.1.1 … N.1.4`) as in the approve example below — because the self-check is
`N.1` and the throw is its child.

```
Svc -> Svc ++ : 12. Resolve action + read request status
||20||
deactivate Svc
||10||

opt action == approve
    Svc -> Svc ++ : 12.1. Check effective_date >= today
    ||20||
    deactivate Svc
    ||10||
    opt Effective date already passed
        Svc --> Ctrl : 12.1.1. throw Conflict
        ...
    end
end
```

### 1.6e DEFAULT — draw FULL, user trims

By default, draw the **full** diagram: every service-layer guard opt (record-not-found, status
checks, permission/class-access, year-open, date validation, duplicate, etc.) with its self-check
and dedicated query, faithful to the service code. The user will then say which opts to remove.

When the user asks to drop a guard opt, remove it **with** its self-check AND its `Svc -> ORM -> DB`
query. In particular, **dropping the record-not-found guard always removes the initial "Find <X> by
id" lookup too** — do NOT keep it arguing the record is reused downstream (class-access / year-open /
update steps are treated as self-contained). Default to removing the query with its guard; keep a
query only if the user explicitly says so. Renumber sequentially after removal.

When a combined guard opt covers two failures (e.g. `Year missing OR ended` = NotFound + Conflict),
the user may ask to keep only one — drop the other throw/message, narrow the self-check + opt label
to the kept condition.

### 1.6f No BR/EF rule codes in labels

Do NOT show business-rule / error-flow codes (`BR-088`, `BR-097/107`, `EF-65-05`, etc.) in any
diagram label, opt guard, or note. Describe the check in plain words only
(e.g. `Check now <= end_date`, `opt Year ended`, `Recalculate growth (WHO z-scores, BMI, statuses)`).
Keep BR/EF references for the design doc, not the diagram.

### 1.6g Multi-branch `alt` → child numbering off the preceding step

A multi-branch business `alt` (e.g. clear / update / create) is numbered as CHILDREN of the step
that precedes it (the decider, e.g. step `12. Return existing`). Each branch's first message is
`12.1`, `12.2`, `12.3`; that branch's own messages then nest one level deeper: `12.1.1`, `12.1.2`,
`12.1.3`, etc.

```
ORM --> Svc : 12. Return existing
alt <branch A>
    Svc -> ORM : 12.1. Delete ...
    ORM -> DB : 12.1.1. DELETE ...
    DB --> ORM : 12.1.2. OK
    ORM --> Svc : 12.1.3. OK
else <branch B>
    Svc -> ORM : 12.2. Update ...
    ORM -> DB : 12.2.1. UPDATE ...
    ...
else <branch C>
    Svc -> ORM : 12.3. Create ...
    ...
end
```

(The auth `alt` at step 2 keeps its existing `2.1 / 2.2` scheme — this child rule is for
service-layer business alts.)

### 1.7 Error branch (service layer)

```
opt <condition>
    Svc --> Ctrl : N.1. throw <NotFound|Conflict|BadRequest|Unauthorized>
    Ctrl --> Route : N.2. Pass error
    Route --> Client : N.3. <code> "<Vietnamese message>"
    Client --> User : N.4. Error message
end
```

- `throw` step names only the error type (`throw NotFound`, `throw NotFound / BadRequest`).
- `Route --> Client` carries the HTTP code + the Vietnamese message. Multiple possible
  messages: separate with `/`.
- **Wrap long messages with `\n`** so the message box doesn't overflow width. Break at `/`
  boundaries (each alternative on its own line); for a single long message, break mid-phrase.
  Example:
  `400 "Không có năm học đang hoạt động" /\n"Ngày hiệu lực phải nằm trong năm học hiện tại"`.
  Leave short single-line messages unwrapped.
- HTTP codes: 400 BadRequest/Validation, 401 Unauthorized, 403 Forbidden, 404 NotFound, 409 Conflict.

### 1.7b Removing a check/opt — also drop its dedicated DB flow

When you drop a self-check + its `opt`, also delete the `Svc -> ORM -> DB` lookup that fed it —
UNLESS that lookup's result is also used downstream (e.g. an id needed by a later step or the
final create). If reused, keep the lookup and mark what it yields (e.g. `Return enrollment (= fromClassId)`).
Renumber all following steps sequentially after any removal.

### 1.8 Transaction note

Only use a transaction (note or bar) when the operation makes **2+ DB writes** that must be atomic.
A single DB write (one `UPDATE`/`INSERT`) is NOT a transaction — draw it as a plain DB round-trip
(§1.10), no `«transaction»` note, no long bar.

Two styles — pick by how much the (multi-write) transaction spans:

**(a) Compact note** — for a transaction that is a single tight block of ORM/DB writes with no
Service logic interleaved. Place a note at the Service step that opens it:

```
note right of Svc
  **«transaction»**
  Steps 10, 14, 23, 27
  On failure: ROLLBACK all & return 500 to Actor
end note
```

**(b) Long activation bar** — when the transaction spans Service logic between writes (e.g. an
apply-condition check between the update and a conditional `applyRequest`), show the tx as ONE
continuous activation bar. The BAR ITSELF represents the transaction — do NOT add explicit
"BEGIN TRANSACTION"/"COMMIT TRANSACTION" message arrows. `activate ORM` (and `activate DB`) at the
first tx write and keep them active — do NOT deactivate per call — then `deactivate DB` /
`deactivate ORM` once at the end. The ORM/DB bars stay open even while control returns to Svc for
the interleaved self-check. Label with one note:

```
Svc -> ORM : N. Update ...
activate ORM
note right of ORM
  **«transaction»** (bar = tx lifetime)
  On failure: ROLLBACK all & return 500 to Actor
end note
ORM -> DB : N+1. UPDATE ...
activate DB
DB --> ORM : ... Return ...
ORM --> Svc : ... Return ...      ' bars stay active
Svc -> Svc ++ : ... Check apply condition ...   ' interleaved Service logic
opt <apply condition>
    Svc -> ORM : ... applyRequest ...
    ORM -> DB : ... UPDATE ...
    DB --> ORM : ... OK
    deactivate DB        ' close DB right after its LAST DB reply — not later
    ORM --> Svc : ... OK
    deactivate ORM       ' close ORM right after its LAST ORM reply
end
```

**Bar-closing order (avoid overhang):** the transaction is ONE continuous bar per object
(ORM from its first tx call, DB from its first query). Close each bar immediately after that
object's OWN last message, innermost first: `deactivate DB` right after the final `DB --> ORM`,
then `deactivate ORM` right after the final `ORM --> Svc`. Never defer a `deactivate` past a later
arrow on another lifeline — the bar would visibly overhang the frame.

### 1.9 Loop

```
loop for each <x> in <collection>
    ORM -> DB : N.1. <op>
    activate DB
    DB --> ORM : N.2. OK
    deactivate DB
end
```

### 1.10 DB round-trip idiom

```
Svc -> ORM : N. <intent>
activate ORM
ORM -> DB : N+1. <Query|INSERT|UPDATE|SELECT COUNT(*)>
activate DB
DB --> ORM : N+2. Return row / OK
deactivate DB
ORM --> Svc : N+3. Return <result>
deactivate ORM
```

### 1.11 Success tail (standard ending)

```
Svc --> Ctrl : N. Return <x>
deactivate Svc
Ctrl --> Route : N+1. res.success(<x>)        ← res.paginated({data, meta}) for lists
deactivate Ctrl
Route --> Client : N+2. 200 OK / 201 Created
deactivate Route

Client --> User : N+3. Show <result>
deactivate Client
```

Do NOT add a `Client -> Client` self-call for toast / refresh / close dialog — go straight from the
`Route --> Client` response to the final `Client --> User : Show <result>`.

### 1.12 Language rule

- Step actions & technical labels: **English**.
- User-facing messages (errors, toasts): **Vietnamese** (e.g. `"Năm học {name} đã tồn tại"`, `"Chỉ Hiệu trưởng có quyền"`).
- Multiline payloads in a message: use `\n`, e.g. `2. POST /api/accounts/:id/assign-role\n{ role, password }`.
- **Wrap ANY long label with `\n`** — not just error messages. Applies to request payloads,
  self-call logic steps, query descriptions, etc. Break at a natural boundary (comma, `/`,
  clause) so no single label overflows the diagram width. Leave short labels unwrapped.

---

## 2. Class diagrams (`CD_*`)

### 2.1 Header (paste verbatim)

```
@startuml CD_<Name>
<style>
classDiagram {
    BackgroundColor #FFFFFF
    BorderColor #000000
    FontColor #000000
    FontSize 11
    class {
        BackgroundColor #FFFFFF
        BorderColor #000000
        FontColor #000000
        HeaderBackgroundColor #FFFFFF
        FontSize 11
        Padding 2
    }
    arrow {
        FontSize 10
    }
}
</style>

skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam ArrowColor #000000
skinparam DefaultFontColor #000000
skinparam Nodesep 20
skinparam Ranksep 30
skinparam defaultFontSize 11
hide circle
hide empty members
skinparam classAttributeIconSize 0

left to right direction
```

### 2.2 Structure

- Group related classes with `together { ... }` (e.g. middleware + schema together; entities together).
- Stereotypes (always present): `<<Middleware>>`, `<<Validator>>`, `<<Router>>`, `<<Controller>>`, `<<Service>>`, `<<ORM Client>>`, `<<Entity>>`.
- Visibility: `-` private (deps, secrets), `+` public (methods, routes, entity fields).
- `--` separator between attributes and methods.
- Method signatures include param names + return type: `+login(email, password) : AuthResponse`.
- Router lists endpoints as members: `+POST /login`, `+GET /accounts/:id`.

### 2.3 Relationships

```
Router --> Middleware : uses
Router --> Schema : validates
Router --> Controller : delegates
Controller --> Service : calls
Service --> PrismaClient : calls prisma query
Service --> EmailService : sends email
PrismaClient ..> Account : query           ← dotted = dependency/query
Teacher "1" *-- "0..1" Account : owns       ← composition with multiplicity
Student "1" *-- "0..1" Account : owns
```

---

## 3. Naming & misc

- Diagram id: `SEQ_<PascalActionName>` / `CD_<PascalModuleName>`.
- File section banner style (in the combined `.txt`):
  `==================== <Module> / <DiagramId> ====================`
- One `@startuml` … `@enduml` per diagram.
- Reuse auth via REF rather than redrawing middleware each time.
