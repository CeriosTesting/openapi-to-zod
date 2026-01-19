---
"@cerios/openapi-to-zod-playwright": minor
"@cerios/openapi-to-zod": minor
---

Changes default for useOperationId to false

Changes the default behavior for method name generation from operationId-based to path-based naming, providing more predictable and consistent method names by default.

Adds support for $ref resolution in OpenAPI parameters, request bodies, and responses, enabling proper handling of reusable component definitions throughout the spec.

Implements path-level parameter merging so that parameters defined at the path level are correctly inherited by all operations on that path, following OpenAPI specification.

Improves Zod v4 compatibility by using dedicated format validators (email, url, uuid) as top-level validators instead of string refinements.

Restricts defaultNullable to apply only to primitive property values within objects, excluding schema references, enums, const/literal values, and top-level definitions. This prevents unintended nullable annotations on discrete value types and schema references where nullability should be explicit.

Migrates allOf composition from deprecated .merge() to Zod v4 compliant .extend() method for object schemas while maintaining .and() for primitives.

Adds emptyObjectBehavior option to control how objects without properties are generated, supporting strict, loose, and record modes for better schema flexibility.

Enhances union validation with improved edge case handling including single-item simplification, empty array detection with warnings, and discriminator validation that falls back to standard unions when discriminator properties aren't required across all schemas.

Introduces property conflict detection in allOf compositions to warn developers of potential schema inconsistencies.