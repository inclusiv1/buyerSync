-- Preserve legacy checklist criteria in the collaborative decision engine.
INSERT INTO "DecisionCriterion" (
    "id", "groupId", "name", "description", "category", "weight", "scaleMax", "isDealbreaker", "sortOrder", "createdAt"
)
SELECT
    'legacy-' || item."id",
    item."groupId",
    item."label",
    'Migrated from the original checklist',
    'custom',
    COALESCE((SELECT AVG(weight."weight") FROM "UserItemWeight" weight WHERE weight."checklistItemId" = item."id"), 5),
    10,
    CASE WHEN item."category" = 'must-have' THEN true ELSE false END,
    1000,
    CURRENT_TIMESTAMP
FROM "ChecklistItem" item
WHERE NOT EXISTS (
    SELECT 1 FROM "DecisionCriterion" criterion
    WHERE criterion."groupId" = item."groupId" AND lower(criterion."name") = lower(item."label")
);

-- Carry prior yes/no property evaluations into the matching consolidated criterion.
INSERT OR IGNORE INTO "CriterionRating" (
    "id", "propertyId", "criterionId", "userId", "value", "dealbreakerTriggered", "createdAt", "updatedAt"
)
SELECT
    'legacy-' || status."propertyId" || '-' || status."checklistItemId" || '-' || status."checkedByUserId",
    status."propertyId",
    criterion."id",
    status."checkedByUserId",
    CASE
        WHEN criterion."isDealbreaker" THEN 0
        WHEN status."isMet" = 'yes' THEN criterion."scaleMax"
        WHEN status."isMet" = 'no' THEN 1
        ELSE CAST((criterion."scaleMax" + 1) / 2 AS INTEGER)
    END,
    CASE WHEN criterion."isDealbreaker" AND status."isMet" = 'no' THEN true ELSE false END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "PropertyItemStatus" status
JOIN "ChecklistItem" item ON item."id" = status."checklistItemId"
JOIN "DecisionCriterion" criterion ON criterion."id" = (
    SELECT match."id" FROM "DecisionCriterion" match
    WHERE match."groupId" = item."groupId" AND lower(match."name") = lower(item."label")
    LIMIT 1
);

INSERT OR IGNORE INTO "DecisionSubmission" ("id", "propertyId", "userId", "submittedAt")
SELECT
    'legacy-' || status."propertyId" || '-' || status."checkedByUserId",
    status."propertyId",
    status."checkedByUserId",
    CURRENT_TIMESTAMP
FROM "PropertyItemStatus" status
GROUP BY status."propertyId", status."checkedByUserId";