# Refresh Narrator's data from Peec MCP

This is the canonical prompt to regenerate `dashboard/data.json` from live Peec data.

## How to use it

1. Make sure the **Peec AI** MCP connector is enabled in your Claude Code / Claude Desktop session (see `.mcp.json` or the Connectors menu).
2. Open Claude in this project directory.
3. Paste the prompt below into a new Claude message.
4. Claude will call the Peec MCP tools, classify sampled chats, and write the updated `data.json`.

When the run finishes, refresh `http://localhost:8080` and the dashboard shows live data for your own brand.

---

## The prompt (copy-paste everything below this line)

You are regenerating `dashboard/data.json` for the Narrator dashboard using the Peec AI MCP connector.

**Step 1 - Discover the project and brand.**

- Call `list_projects` (Peec) and pick the first active project. Call its `id` `PROJECT_ID`.
- Call `list_brands(PROJECT_ID)`. Pick the brand with `is_own = true`. Call it `OWN_BRAND` (use its `id`, `name`, and `domains`).
- Pick one competitor to feature. Default: if `Dell` exists, use it. Otherwise pick the tracked brand with the highest visibility that is not `OWN_BRAND`. Call it `VS_BRAND`.

**Step 2 - Define the date window.**

Use a 7-day window ending today. Set `WINDOW_START = today - 6 days`, `WINDOW_END = today` (YYYY-MM-DD). If `get_brand_report` returns empty for that window, widen to 28 days and note it.

**Step 3 - Pull the quantitative data.**

Run all of these against the same `WINDOW_START`/`WINDOW_END`:

1. `get_brand_report(project_id=PROJECT_ID)` - base for `chats_mentioning_hp`, `total_chats`, and own-brand headline numbers.
2. `get_brand_report(project_id=PROJECT_ID, dimensions=["model_id"], filters=[brand_id in OWN_BRAND])` - per-AI visibility, sentiment, position.
3. `get_brand_report(project_id=PROJECT_ID, dimensions=["topic_id"], filters=[brand_id in OWN_BRAND, VS_BRAND])` - per-topic visibility for both brands.
4. `get_brand_report(project_id=PROJECT_ID, dimensions=["model_id", "topic_id"], filters=[brand_id in OWN_BRAND])` - the AI × topic matrix.
5. `list_topics(PROJECT_ID)` - to map topic_id → topic name.
6. `list_models(PROJECT_ID)` - to map model_id → human model name, and to know which models are `is_active`.
7. `get_domain_report(project_id=PROJECT_ID)` - top source domains. Pick the 5-8 highest-retrieval EDITORIAL/CORPORATE domains that mention OWN_BRAND.
8. `get_url_report(project_id=PROJECT_ID, filters=[mentioned_brand_id in OWN_BRAND], limit=10)` - top articles mentioning OWN_BRAND.

**Step 4 - Sample and classify chats.**

- Call `list_chats(project_id=PROJECT_ID, brand_id=OWN_BRAND, limit=12)` over the window.
- For each of ~6 chats (mix of models and topics), call `get_chat(project_id, chat_id)` and read the assistant message.
- Classify OWN_BRAND's position in each response as one of:
  - **primary** - own brand is the lead recommendation (phrases: "Best Overall", "our top pick", "the recommendation", own brand mentioned first with no hedging).
  - **alternative** - own brand appears after a different lead (phrases: "or similar from", "top alternates", "you could also consider", own brand bracketed as an aside).
  - **alongside** - own brand is listed in a peer group without a clear leader (e.g., "brands like A, own brand, C, D").
  - **absent** - own brand is not mentioned in the response.
- For each classified chat, extract the specific quoted sentence that supports the classification plus a 2-6 word `hp_context` substring that you'd highlight.

**Step 5 - Classify top storyteller articles.**

For each of the 5-8 storytellers from Step 3.7/3.8, set:

- `hp_framing`: one of `primary`, `alternative`, `alongside`, `absent-or-weak`.
- `framing_source`:
  - `"verified"` if you read a chat text that cites this URL AND confirms the framing.
  - `"inferred"` otherwise - and write a specific `framing_evidence` note describing what signals you used (e.g., "HP's 9% visibility on the monitor topic + this is the top retrieved source on monitor prompts. Not verified by reading article.").
- `effect`: one-sentence description of the narrative effect.
- `action`: a single concrete next move.

Do not invent framings. If you cannot justify a classification from the data, use `alongside` + `inferred` and say so.

**Step 6 - Compute the Alternative Index.**

- `sample_size` = number of chats you classified where OWN_BRAND was mentioned.
- `primary_rate`, `alternative_rate`, `alongside_rate` = proportions of those classifications.
- `headline_pct` = round(`alternative_rate * 100`).
- `headline_label` = `"<OWN_BRAND.name> is framed as 'the alternative' in <headline_pct>% of classified chats"`.
- `confidence` = `"directional"` if `sample_size < 15`, else `"validated"`.
- `confidence_note` = explain sample size and how to promote to validated (classify 30+ chats).

**Step 7 - Pick the "one move".**

Scan the category ownership data and AI × topic matrix for the topic where:

- OWN_BRAND's visibility is lowest, AND
- VS_BRAND's visibility is meaningfully higher.

Build:

- `move.headline`: e.g., "Win the monitor topic, or concede it".
- `move.body`: describe the gap quantitatively and name the single top retrieved article driving the competitor's lead (from Step 3).
- `move.owner`, `move.timeline`, `move.expected_impact`: sensible defaults.
- `move.pitch_template`: a concrete `{to, subject, body, success_metric}` email pitching the editor of that driving article. Use real product details from OWN_BRAND if known, otherwise use realistic placeholders.

**Step 8 - Write data.json.**

Write a single JSON object with exactly these top-level keys, matching the schema below. Overwrite `dashboard/data.json` in place. Preserve the existing schema shape so the dashboard keeps rendering.

```
{
  "meta": {
    "brand", "competitor_focus", "window_label",
    "total_chats", "chats_mentioning_hp", "chats_classified",
    "active_ais", "generated_at"
  },
  "alt_index": {
    "headline_pct", "headline_label",
    "sample_size", "confidence", "confidence_note",
    "primary_rate", "alternative_rate", "alongside_rate",
    "sentiment_for_reference", "position_for_reference",
    "explainer"
  },
  "methodology": { "title", "items": [{label, desc}], "process" },
  "evidence": [{ "model", "prompt", "quote", "hp_context", "classification", "chat_id" }],
  "per_ai":   [{ "model", "visibility", "sentiment", "position", "dominant_framing", "unique_signal" }],
  "ai_topic_matrix": {
    "note",
    "rows": [{ "topic", "chatgpt", "perplexity", "ai_overview" }]
  },
  "category_ownership": [{ "topic", "hp_visibility", "hp_sov", "dell_visibility", "dell_sov", "verdict", "insight" }],
  "storytellers": [{ "publication", "domain", "classification", "article", "url", "retrievals", "citations", "hp_framing", "framing_source", "framing_evidence", "effect", "action" }],
  "move": {
    "headline", "body", "owner", "timeline", "expected_impact",
    "pitch_template": { "subject", "to", "body", "success_metric" }
  }
}
```

Use the exact keys `hp_visibility`, `hp_sov`, `dell_visibility`, `dell_sov`, `chats_mentioning_hp` even if the own brand is not HP - the dashboard currently reads those keys and we are not changing the frontend.

Set `meta.generated_at` to the current ISO timestamp.

**Step 9 - Report back.**

Print a short summary to the chat:
- OWN_BRAND, VS_BRAND, window used
- Alternative Index headline
- The "one move" headline
- Number of chats classified and how many were verified

Then confirm the file was written.
