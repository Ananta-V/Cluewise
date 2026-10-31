# Cluewise — Unified GPT Prompt Generation & Self-Describing JSON Guide

> Complete reference for creating GPT-generated JSON learning packs for **Cluewise — Business & Economics Crossword Vocabulary Companion**.

---

## 1. Curriculum Hierarchy

Learning content in Cluewise follows a clean 4-tier hierarchy:

$$\textbf{Domain} \longrightarrow \textbf{Category} \longrightarrow \textbf{Subcategory} \longrightarrow \textbf{Batch}$$

| Level | Role in Cluewise | Concrete Example |
|---|---|---|
| **Domain** | Broader academic field (one of the 6 main domains) | `Economics` |
| **Category** | The specific selectable category (one of the 40 catalogue categories) | `Economic Fundamentals` |
| **Subcategory** | The conceptual topic planned by GPT or user focus area | `Basic Economic Concepts` |
| **Batch** | The individual learning set / batch title (~30 questions) | `Meaning, Scarcity and Choice` |

---

## 2. Cross-Category Relationships & Knowledge Connections

Business and economics concepts do not exist in isolated silos — crossword clues frequently bridge terminology from multiple categories.

Cluewise recognizes **three types of concepts**:

1. **Core Concepts**: Directly belong to the selected category (e.g. `Scarcity` in *Economic Fundamentals*). These form the primary curriculum.
2. **Supporting / Related Concepts**: Belong to other categories (e.g. `Demand` and `Supply` from *Demand & Supply*) but are crucial for understanding the core material or recognizing cross-category crossword clues. Included naturally with `concept_scope: "supporting"` and `related_category`.
3. **Extended Concepts**: Useful peripheral concepts. Mentioned briefly in explanations or `deeper_prompt`s without creating separate batches.

### Curriculum Isolation & Concept Separation Rule
- `concepts_covered`: MUST ONLY contain core concepts that belong directly to the selected Category (`category`).
- `concepts_remaining`: MUST ONLY contain remaining uncompleted core concepts for this category.
- `supporting_concepts_covered`: Tracks supporting concepts introduced from other categories (e.g. `[ { "concept": "demand", "source_category": "Demand & Supply" } ]`).
- **Critical Isolation Principle**: Introducing a supporting concept (e.g. *Demand* while studying *Economic Fundamentals*) does **NOT** count as completing that concept in its home category (*Demand & Supply*). When the learner later studies *Demand & Supply*, its curriculum is explored comprehensively from foundational principles.

### Avoiding Repetition
When a concept previously introduced in one category appears later in another:
- GPT avoids repeating basic introductory definitions.
- Explores new dimensions, practical business applications, and fresh crossword clue angles.

---

## 3. Standard Canonical Question Schema

All questions — both core and supporting — must follow the exact canonical question schema:

```json
{
  "id": "ECO-EF-BEG-001-01",
  "type": "definition_to_term",
  "concept": "Scarcity",
  "concept_scope": "core",
  "question": "What is the economic term for the condition in which resources are limited but human wants are unlimited?",
  "options": [
    "Scarcity",
    "Abundance",
    "Equilibrium",
    "Utility"
  ],
  "answer": "Scarcity",
  "explanation": "Scarcity is the fundamental economic problem of having seemingly unlimited human wants in a world of limited resources.",
  "crossword_clue": "Condition of limited resources versus unlimited wants.",
  "deeper_prompt": "Explain scarcity in economics: why it requires choices, its relationship to opportunity cost, and common crossword clues."
}
```

### Supporting Concept Question Example
For supporting concepts borrowed from another category, the exact same schema is used, with `concept_scope` set to `"supporting"` and `related_category` specified:

```json
{
  "id": "ECO-EF-BEG-001-02",
  "type": "definition_to_term",
  "concept": "Demand",
  "concept_scope": "supporting",
  "related_category": "Demand & Supply",
  "question": "What term describes consumer willingness and financial ability to purchase a product at various prices?",
  "options": [
    "Demand",
    "Supply",
    "Utility",
    "Elasticity"
  ],
  "answer": "Demand",
  "explanation": "Demand in economics refers to effective demand backed by purchasing power and desire to buy.",
  "crossword_clue": "Desire for a product backed by purchasing power.",
  "deeper_prompt": "Explain demand, its determinants, the law of demand, and common crossword clues."
}
```

### Schema Rules Summary
| Field | Type | Description |
|---|---|---|
| `question` | `string` | **Required.** The question text. Do *not* use `clue` as the question key. |
| `options` | `string[]` | **Required.** Exactly 4 strings. Do *not* use an array of objects `{ text, is_correct }`. |
| `answer` | `string` | **Required.** Must match one of the 4 `options` verbatim (case-sensitive). |
| `explanation` | `string` | **Required.** Explains why the answer is correct and the underlying concept. |
| `crossword_clue` | `string` | **Required.** Crossword clue text. Do *not* include letter-count hints like `(8 letters)` or `(5,7)`. |
| `deeper_prompt` | `string` | **Required.** Ready-to-copy GPT follow-up prompt. Do *not* rename to `educational_tip`. |
| `type` | `string` | **Required.** One of the 15 supported types (use `definition_to_term`, not `definition_meaning`). |
| `concept` | `string` | **Optional.** The specific terminology or concept name (e.g. `Scarcity`, `Demand`). |
| `concept_scope` | `string` | `"core"` (default) or `"supporting"`. |
| `related_category`| `string` | The parent category of the concept when `concept_scope` is `"supporting"`. |

---

## 4. Full Self-Describing JSON Pack Example

```json
{
  "metadata": {
    "domain": "Economics",
    "category": "Economic Fundamentals",
    "subcategory": "Basic Economic Concepts",
    "batch_title": "Meaning, Scarcity and Choice",
    "focus_area": "",
    "level": "beginner",
    "pack_id": "ECO-EF-BEG-001",
    "batch": 1,
    "total_batches": 4,
    "level_status": "in_progress",

    "curriculum_plan": {
      "planned_batches": [
        {
          "batch": 1,
          "title": "Meaning, Scarcity and Choice",
          "subcategory": "Basic Economic Concepts",
          "concepts": [
            "meaning-of-economics",
            "scarcity",
            "economic-choice"
          ],
          "supporting_concepts": [
            {
              "concept": "demand",
              "source_category": "Demand & Supply"
            },
            {
              "concept": "supply",
              "source_category": "Demand & Supply"
            }
          ]
        },
        {
          "batch": 2,
          "title": "Needs, Wants and Utility",
          "subcategory": "Needs & Wants",
          "concepts": [
            "needs",
            "wants",
            "utility"
          ],
          "supporting_concepts": [
            {
              "concept": "consumer-behaviour",
              "source_category": "Consumer Behaviour"
            }
          ]
        }
      ]
    },

    "batch_concepts": [
      "meaning-of-economics",
      "scarcity",
      "economic-choice"
    ],

    "concepts_covered": [
      "meaning-of-economics",
      "scarcity",
      "economic-choice"
    ],

    "concepts_remaining": [
      "needs",
      "wants",
      "utility"
    ],

    "supporting_concepts_covered": [
      {
        "concept": "demand",
        "source_category": "Demand & Supply"
      },
      {
        "concept": "supply",
        "source_category": "Demand & Supply"
      }
    ]
  },

  "questions": [
    {
      "id": "ECO-EF-BEG-001-01",
      "type": "definition_to_term",
      "concept": "Scarcity",
      "concept_scope": "core",
      "question": "What is the economic term for the condition in which resources are limited but human wants are unlimited?",
      "options": ["Scarcity", "Abundance", "Equilibrium", "Utility"],
      "answer": "Scarcity",
      "explanation": "Scarcity is the fundamental economic problem of having seemingly unlimited human wants in a world of limited resources.",
      "crossword_clue": "Condition of limited resources versus unlimited wants.",
      "deeper_prompt": "Explain scarcity in economics: why it requires choices, its relationship to opportunity cost, and common crossword clues."
    },
    {
      "id": "ECO-EF-BEG-001-02",
      "type": "definition_to_term",
      "concept": "Demand",
      "concept_scope": "supporting",
      "related_category": "Demand & Supply",
      "question": "What term describes consumer willingness and financial ability to purchase a product at various prices?",
      "options": ["Demand", "Supply", "Utility", "Elasticity"],
      "answer": "Demand",
      "explanation": "Demand in economics refers to effective demand backed by purchasing power and desire to buy.",
      "crossword_clue": "Desire for a product backed by purchasing power.",
      "deeper_prompt": "Explain demand, its determinants, the law of demand, and common crossword clues."
    }
  ]
}
```

---

## 5. Supported Question Types (15 Canonical Types)

Cluewise supports the following question types:

1. `definition_to_term` — Clue or definition where the answer is the economic term.
2. `term_to_definition` — Economic term provided, answer is its correct definition.
3. `fill_in_the_blank` — Sentence with a missing business/economic term.
4. `concept_identification` — Scenario or description identifying the underlying principle.
5. `difference_identification` — Distinguishing between two similar or related terms.
6. `similar_terms` — Identifying synonyms or closely related crossword terms.
7. `classification` — Grouping a term into its correct category (e.g. consumer good vs capital good).
8. `odd_one_out` — Finding the concept that does not belong.
9. `scenario_identification` — Real-world business context illustrating a concept.
10. `concept_association` — Linking two interconnected terms or principles.
11. `acronym_recognition` — Expanding or identifying standard business/economic acronyms.
12. `statement_based` — Evaluating which statement accurately describes a term.
13. `cause_and_effect` — Business or economic outcome resulting from an action.
14. `crossword_clue_interpretation` — Direct analysis of how a clue points to the answer.
15. `case_study` — Applied mini-scenario question.

*(Note: Common synonyms like `definition_meaning` or `contrast_distinction` are defensively normalized by Cluewise into these canonical types).*

---

## 6. Batch Continuation Workflow

To generate the next batch, provide ChatGPT with:
1. The `metadata` block from the current batch.
2. The simple instruction: `"Continue with the next batch."`

GPT will automatically:
1. Reuse the same `pack_id`.
2. Increment `batch` by 1.
3. Select the next planned batch from `curriculum_plan`.
4. Update `batch_concepts` to the new batch's core concepts.
5. Update `concepts_covered` (core concepts only).
6. Update `supporting_concepts_covered` (supporting concepts from other categories).
7. Update `concepts_remaining`.
8. Set `level_status: "complete"` if this is the final batch.
