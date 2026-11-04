# InfoCube – role-playing dimensions: behaviour spec

Status: **accepted and prototyped** (Łukasz, 4 November 2026). Built in the prototype
(`infomapper-prototype-with-sources.html`, 646,126 bytes, SHA-256
`bf2251d937d1eb675163729a34a41ed121ca66ea66f58a8d84483bc4c5575c71`); RP-01 to RP-14 pass in headless Chromium. In the
application it is built in slice 15b, in place of the key-name match (RQ-3). Builds on `infocube-iteration-1-spec.md` and
replaces its "built rule, to be replaced by role-playing": a fact's key matched to a dimension by the name of the
dimension's primary key.

## Why

A fact often uses one dimension more than once, each time in another meaning: Fact Sales has an order date and a ship
date, both in Dim Date. In the model these are two relationships between the same fact and dimension, each with its
own key. Drawing two such relationships already works; what is missing is the role's name and which key carries which
relationship. The key-name match cannot express it: `order_date_key` and `ship_date_key` are not called `date_key`,
and two relationships to one dimension merge into one row (the fact panel, the dimension's "Used by", the bus matrix,
the delete preview).

## Decisions (accepted 4 November 2026)

- **RP-A. The role name lives on the relationship, in InfoMapper.** Two optional fields, one per end
  (`fromRole`, `toRole`; in the application two nullable columns on `relationship`). Generic: a logical
  relationship can carry roles too (Order → Address as billing and shipping). It adds no dimensional meaning to
  InfoMapper (C-4). This is `docs/ideas.md`'s "Role names per relationship end".
- **RP-B. The key link lives in InfoCube.** `S.cube.keys = [{id, rel, attr}]` (in the application a module table,
  e.g. `cube_key`): this relationship between a fact and a dimension is carried by this attribute of the fact.
- **RP-C. No match by name.** A key is linked explicitly, by picking an existing foreign key or by **Add key**. Models
  saved before this change are linked once by the old rule (Migration). After that, renaming a key or the
  dimension's primary key never breaks a link.
- **RP-D. The canvas.** The relationship's label pill shows its roles when any are set, otherwise its verb phrase.
  No new SVG element (AD-24).
- **RP-E. The bus matrix** shows one dot per relationship.
- **RP-F. Demo:** Fact Sales gets a second relationship to Dim Date as "Ship date" with a new key `ship_date_key`.

## Data

| Where | What | Rules |
| --- | --- | --- |
| Relationship (InfoMapper) | `fromRole`, `toRole`: text, optional, trimmed, empty = none | Any relationship, any level. |
| `S.cube.keys` (InfoCube) | `{id, rel, attr}` | `rel` joins a fact and a dimension. `attr` belongs to that fact. One key per relationship; one relationship per attribute. Linking sets the attribute's FK flag. |

**Removal (one undo step with the change that causes it):** the link goes when its relationship or attribute is
deleted, when the attribute's FK flag is cleared, or when the relationship no longer joins a fact and a dimension.
The relationship and the attribute themselves stay. Turning a relationship (swap) keeps the link.

**Nothing else is stored.** Which dimensions a fact uses, its missing keys, "Used by" and the bus matrix are derived
from the relationships and the links. `factKeys()` becomes one row per relationship: `{rel, dim, role, key}`.

## Behaviour

### R-1. The relationship panel (every relationship)

- Two fields after the verb phrase: **"Role of {from entity}"** and **"Role of {to entity}"**, placeholder
  "e.g. Ship date". One undo step per edit.
- The sentences add the role after the entity it belongs to: "Each Fact Sales is related to exactly one Dim Date
  **as Ship date**."
- For a relationship between a fact and a dimension, an InfoCube section **"Key in {fact}"**:
  - a select of the fact's foreign keys that carry no other relationship, plus "None";
  - **Add key**, shown while no key is linked (R-3);
  - a note while the dimension has no primary key: "{dimension} has no primary key yet."

### R-2. The fact's panel: Dimensions

One row per relationship, not per dimension: **"{dimension} as {role}"** (or "{dimension}" without a role), then the
key's name, or "no key" in the warning style with **Add key**. Clicking the row opens the relationship.

### R-3. Add key

- Creates an attribute in the fact named `{role}_{pk}`, the role in snake case, without repeating the word both share:
  Ship date + `date_key` → `ship_date_key`; Bill to + `customer_key` → `bill_to_customer_key`. Without a role: `{pk}`.
  (The shared word is the primary key's name before `_key`, `_id` or `_sk`.) The type is the dimension's primary key's; the FK flag is on; it goes after the fact's last key attribute.
- If the name is taken, it is numbered as default names are (`ship_date_key_2`).
- Links it to the relationship. One undo step removes both.
- Disabled while the dimension has no primary key, titled with R-1's note.

### R-4. Hints in the fact's panel (replace B-5's key hints)

| When | Text |
| --- | --- |
| A relationship to a dimension has no key | "{dimension} is related, but no key carries it." / "{dimension} as {role} is related, but no key carries it." with **Add key** |
| A foreign key of the fact carries no relationship | "{attribute} is a foreign key but carries no dimension." |
| Two or more relationships to one dimension, and any of them has no role | "{dimension} is related {n} times. Name each role." |
| Two relationships to one dimension with the same role | "{dimension} plays {role} twice." |
| The fact has no relationship to a dimension | "No dimension keys" (as today) |

The other B-5 hints (grain, measures) are unchanged.

### R-5. The dimension's panel: "Used by"

One row per relationship, as in the fact's panel: "Fact Sales as Order date – key `date_key`", "Fact Sales as Ship date –
key `ship_date_key`", "Fact Orders as Order date – key `date_key`"; "no key" in the warning style. Clicking a row opens
the fact. (One line per fact with all its roles was tried first: it pushed the fact's name out of a narrow panel.)

### R-6. A foreign key's panel in a fact

A read-only line **"Carries {dimension} as {role}"** (or "Carries {dimension}"), linking to the relationship.

### R-7. The canvas

- The label pill shows the roles when any is set: one role alone, or "{from role} / {to role}" when both are set.
  Otherwise it shows the verb phrase, as today. A fact – dimension relationship normally has a role at the dimension
  end only.
- Two relationships between the same cards are drawn **20 px** apart (was 16 px), so their 18 px label pills never
  overlap.

### R-8. The bus matrix

- A cell shows one dot per relationship between the fact and the dimension (●● for two roles).
- Each dot's title: "{fact} uses {dimension} as {role}: {key}" (without a role or key, those parts are left out);
  clicking it opens that relationship.
- A hollow dot (○) still marks a relationship whose key is missing.
- The footer counts facts per dimension, not relationships.

### R-9. Delete previews (X-1 to X-4)

- **An attribute that carries a key:** a row "Carries {dimension} as {role} – the link is deleted; the relationship
  stays".
- **A dimension:** "{n} facts – lose this dimension: …" lists each fact once (fixes R3 of the first review).
- **A relationship:** no dialog, as today; its link goes in the same undo step.

### R-10. C-7 in the prototype, aligned with the application (U1, RQ-2)

The prototype's read-only mode is gone, as in slice 15a:

- InfoCube is on when the workspace's switch is on; the licence is read only when someone turns it on.
- Turning it off is refused while the workspace has facts or dimensions, shown under the check box without a toast:
  "InfoCube can be turned off only when this workspace has no facts or dimensions. It has {n}: delete them first."
- While off, nothing adds or brings back a fact or dimension: create, undo and redo are refused with "InfoCube is off
  in this workspace, so no fact or dimension can be added or brought back. An owner or admin can turn it on in the
  workspace settings."; a refused undo keeps its step.
- The settings text, the "InfoCube is off." toast and the card titles are slice 15a's. The hatched header and the
  panels' read-only note are removed.

## Migration (once, on load)

For every relationship between a fact and a dimension with no link: if the fact has exactly one foreign key named as
the dimension's primary key, and it carries no other relationship, link them. Otherwise leave it unlinked; R-4 then
shows the hint. No role is invented. Logged nowhere, not an undo step.

## Demo

- Fact Sales – Dim Date (existing): role "Order date" at Dim Date's end, key `date_key`.
- Fact Sales – Dim Date (new): role "Ship date", key `ship_date_key` (Integer, FK). It is unfed because the demo
  logical model has no ship date.
- Fact Orders – Dim Date: role "Order date", key `date_key`.
- Other relationships: no role.

## Scenarios

Each with undo and redo.

| ID | Steps | Expected |
| --- | --- | --- |
| RP-01 | Open the Sales star | Two lines between Dim Date and Fact Sales, pills "Order date" and "Ship date" |
| RP-02 | Select Fact Sales | Dimensions: Dim Customer, Dim Product, Dim Date as Order date (`date_key`), Dim Date as Ship date (`ship_date_key`); no key hints |
| RP-03 | Draw a third relationship Dim Date → Fact Sales | Hints: "Dim Date is related 3 times. Name each role." and "Dim Date is related, but no key carries it." |
| RP-04 | Name its role "Payment date", then Add key | `payment_date_key` (Integer, FK) after the last key, linked; hints gone. One undo removes the attribute and the link; the role stays |
| RP-05 | Open the key select of the Ship date relationship | `ship_date_key` selected; `date_key` not offered (it carries Order date) |
| RP-06 | Clear the FK flag of `ship_date_key` | Link gone; hint "Dim Date as Ship date is related, but no key carries it." Undo restores both |
| RP-07 | Delete `ship_date_key` | Preview row "Carries Dim Date as Ship date – the link is deleted; the relationship stays". Undo restores |
| RP-08 | Delete the Ship date relationship | Its line goes; hint "ship_date_key is a foreign key but carries no dimension." Undo restores the relationship and the link |
| RP-09 | Delete Dim Date | Preview lists "2 facts – lose this dimension: Fact Sales, Fact Orders", each once |
| RP-10 | Open the bus matrix | Fact Sales × Dim Date shows ●●; titles name the roles and keys; each dot opens its relationship |
| RP-11 | Select Dim Date | Used by: "Fact Sales as Order date – key `date_key`", "Fact Sales as Ship date – key `ship_date_key`", "Fact Orders as Order date – key `date_key`" |
| RP-12 | Rename Dim Date's `date_key` to `date_sk` | Links unchanged; no key hints (the name rule is gone) |
| RP-13 | Load a model saved before this change | Links made by the old rule; nothing else changes |
| RP-14 | On a logical relationship, set a role "billing" | The pill shows "billing"; the sentences name it; no InfoCube section |

## Out of scope

- Roles in a dimension's relationship to itself (hierarchies, a backlog item).
- Composite keys.
- Role views: a dimension's attributes renamed per role ("Ship date year").
- A generic link from a logical foreign key to its relationship (K2).
- A dialog when a relationship is deleted.

## Answers (Łukasz, 4 November 2026)

- **RQ-1.** The same role twice at one dimension is a hint (R-4), not a refusal.
- **RQ-2.** The prototype's C-7 is aligned with the application in the same pass (R-10).
- **RQ-3.** Option 2: slice 15b builds the key links and role names directly; the key-name match is never built in the
  application. 15b therefore changes InfoMapper's `relationship` (two nullable columns) and the local data file's
  format, and its data step gets a full e2e run.
