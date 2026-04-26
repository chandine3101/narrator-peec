// Narrator - Peec AI dashboard logic
(async function () {
  const data = await fetch("./data.json?v=" + Date.now(), { cache: "no-store" }).then((r) => r.json());
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  const classLabel = {
    primary: "Primary",
    alternative: "Alternative",
    alongside: "Alongside",
    "absent-or-weak": "Absent / weak",
    absent: "Absent",
    "primary-or-absent": "Primary or absent",
  };
  const framingLabel = {
    primary: "Frames HP as primary",
    alternative: "Frames HP as alternative",
    alongside: "Lists HP alongside peers",
    "absent-or-weak": "HP absent or weakly positioned",
  };

  // ---------- HEADER / HERO ----------
  document.getElementById("brandName").textContent = data.meta.brand;
  document.getElementById("altIndexPct").textContent = data.alt_index.headline_pct;
  document.getElementById("altIndexLabel").textContent = data.alt_index.headline_label;
  document.getElementById("altIndexSub").textContent = data.alt_index.explainer;
  document.getElementById("altIndexConf").textContent = data.alt_index.confidence;
  document.getElementById("altIndexSample").textContent =
    "Sample size: " + data.alt_index.sample_size + " chats · " + data.alt_index.confidence_note;

  document.getElementById("metaBrand").textContent = data.meta.brand;
  document.getElementById("metaWindow").textContent = data.meta.window_label;
  document.getElementById("metaChats").textContent =
    data.meta.chats_mentioning_hp + " of " + data.meta.total_chats;
  document.getElementById("metaAis").textContent = data.meta.active_ais.join(", ");
  document.getElementById("generatedAt").textContent = new Date(data.meta.generated_at).toLocaleString();

  // ---------- EVIDENCE ----------
  const peecBase = data.meta.peec_app_base || "https://app.peec.ai";
  const ownBrandId = data.meta.own_brand_id || "";
  const peecChatLink = (chatId) =>
    `${peecBase}/chats/${encodeURIComponent(chatId)}?brand=${encodeURIComponent(ownBrandId)}`;

  const evidenceEl = document.getElementById("evidence");
  data.evidence.forEach((e) => {
    const quote = esc(e.quote);
    const quoteHTML = e.hp_context
      ? quote.replace(esc(e.hp_context), `<mark class="hp-highlight">${esc(e.hp_context)}</mark>`)
      : quote;
    const card = document.createElement("div");
    card.className = `evidence-card ev-${e.classification}`;
    card.innerHTML = `
      <div class="evidence-head">
        <div class="evidence-model">${esc(e.model)}</div>
        <div class="ev-badge-${e.classification}">${esc(classLabel[e.classification] || e.classification)}</div>
      </div>
      <div class="evidence-prompt">${esc(e.prompt)}</div>
      <blockquote class="evidence-quote">${quoteHTML}</blockquote>
      <a class="evidence-link" href="${esc(peecChatLink(e.chat_id))}" target="_blank" rel="noopener">
        View chat <span class="evidence-arrow">↗</span>
      </a>
    `;
    evidenceEl.appendChild(card);
  });

  // ---------- PER-AI ----------
  const perAiEl = document.getElementById("perAi");
  data.per_ai.forEach((m) => {
    const card = document.createElement("div");
    card.className = "model-card";
    card.innerHTML = `
      <div class="model-head">
        <div class="model-name"><span class="model-dot"></span>${esc(m.model)}</div>
        <div class="ev-badge-${m.dominant_framing}">${esc(
          classLabel[m.dominant_framing] || m.dominant_framing
        )}</div>
      </div>
      <div class="model-stats">
        <div class="model-stat"><span class="model-stat-label">Visibility</span><span class="model-stat-value">${Math.round(
          m.visibility * 100
        )}%</span></div>
        <div class="model-stat"><span class="model-stat-label">Sentiment</span><span class="model-stat-value">${m.sentiment}</span></div>
        <div class="model-stat"><span class="model-stat-label">Position</span><span class="model-stat-value">${m.position}</span></div>
      </div>
      <div class="model-signal">
        <span class="model-signal-label">The narrator signal</span>
        ${esc(m.unique_signal)}
      </div>
    `;
    perAiEl.appendChild(card);
  });

  // ---------- AI × TOPIC MATRIX ----------
  const matrixEl = document.getElementById("matrix");
  const mx = data.ai_topic_matrix;
  const cellColor = (v) => {
    if (v >= 0.65) return { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" };
    if (v >= 0.4) return { bg: "#fefce8", fg: "#a16207", border: "#fde68a" };
    if (v >= 0.15) return { bg: "#fff7ed", fg: "#c2410c", border: "#fed7aa" };
    return { bg: "#fef2f2", fg: "#991b1b", border: "#fecaca" };
  };
  const header = `
    <div class="mx-header">
      <div class="mx-label-topic">Topic · click to see prompts</div>
      <div class="mx-label-ai">ChatGPT</div>
      <div class="mx-label-ai">Perplexity</div>
      <div class="mx-label-ai">AI Overview</div>
    </div>`;
  const rows = mx.rows.map((r) => {
    const cc = cellColor(r.chatgpt),
      cp = cellColor(r.perplexity),
      ca = cellColor(r.ai_overview);
    const promptList = (r.prompts || []).length
      ? `<ul class="mx-prompt-list">${r.prompts
          .map((p) => `<li>${esc(p)}</li>`)
          .join("")}</ul>`
      : `<div class="mx-prompt-empty">No prompts recorded for this topic yet.</div>`;
    return `
      <details class="mx-details">
        <summary class="mx-row">
          <div class="mx-topic">${esc(r.topic)}</div>
          <div class="mx-cell" style="background:${cc.bg};color:${cc.fg};border-color:${cc.border}">${Math.round(
      r.chatgpt * 100
    )}%</div>
          <div class="mx-cell" style="background:${cp.bg};color:${cp.fg};border-color:${cp.border}">${Math.round(
      r.perplexity * 100
    )}%</div>
          <div class="mx-cell" style="background:${ca.bg};color:${ca.fg};border-color:${ca.border}">${Math.round(
      r.ai_overview * 100
    )}%</div>
        </summary>
        <div class="mx-prompts">
          <div class="mx-prompts-head">Prompts tracked under <strong>${esc(r.topic)}</strong></div>
          ${promptList}
        </div>
      </details>`;
  }).join("");
  matrixEl.innerHTML = `<div class="mx-grid">${header}${rows}</div><div class="mx-note">${esc(mx.note)}</div>`;

  // ---------- CATEGORY CHART ----------
  const cats = data.category_ownership;
  new Chart(document.getElementById("categoryChart"), {
    type: "bar",
    data: {
      labels: cats.map((c) => c.topic),
      datasets: [
        {
          label: "HP",
          data: cats.map((c) => +(c.hp_visibility * 100).toFixed(1)),
          backgroundColor: "#ff4820",
          borderRadius: 4,
          barThickness: 22,
        },
        {
          label: "Dell",
          data: cats.map((c) => +(c.dell_visibility * 100).toFixed(1)),
          backgroundColor: "#171717",
          borderRadius: 4,
          barThickness: 22,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: { color: "#525252", usePointStyle: true, padding: 14, font: { size: 12 } },
        },
        tooltip: {
          backgroundColor: "#171717",
          borderWidth: 0,
          titleColor: "#ffffff",
          bodyColor: "#d4d4d4",
          callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x}% visibility` },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(0,0,0,.04)" },
          ticks: { color: "#737373", callback: (v) => v + "%" },
          border: { color: "#e5e5e5" },
          max: 100,
        },
        y: {
          grid: { display: false },
          ticks: { color: "#171717", font: { size: 12 } },
          border: { color: "#e5e5e5" },
        },
      },
    },
  });

  // Category list (verdicts) removed - the chart above + narrative elsewhere cover it.
  const categoryListEl = document.getElementById("categoryList");
  if (categoryListEl) categoryListEl.remove();

  // ---------- CITATION FOOTPRINT (sitemap) ----------
  if (data.citation_footprint && window.d3) {
    const fp = data.citation_footprint;
    document.getElementById("sitemapDomain").textContent = fp.domain;
    document.getElementById("footprintPages").textContent = fp.total_urls;
    document.getElementById("footprintCitations").textContent = fp.total_citations;

    const legendEl = document.getElementById("sitemapLegend");
    legendEl.innerHTML = fp.groups
      .map(
        (g) => `
        <div class="sitemap-legend-row">
          <span class="sitemap-legend-dot" style="background:${esc(g.color)}"></span>
          <span class="sitemap-legend-name">${esc(g.name)}</span>
          <span class="sitemap-legend-count">${g.pages.length}</span>
        </div>`,
      )
      .join("");

    const insightsEl = document.getElementById("sitemapInsights");
    insightsEl.innerHTML = fp.insights
      .map(
        (i) => `
        <div class="sitemap-insight">
          <div class="sitemap-insight-label">${esc(i.label)}</div>
          <div class="sitemap-insight-value">${esc(i.value)}</div>
          <div class="sitemap-insight-detail">${esc(i.detail)}</div>
        </div>`,
      )
      .join("");

    // Build graph data
    const root = {
      id: "__root__",
      label: fp.domain,
      type: "root",
      color: "#171717",
      r: 16,
    };
    const graphNodes = [root];
    const graphLinks = [];
    fp.groups.forEach((g) => {
      const hub = {
        id: "hub::" + g.name,
        label: g.name,
        type: "hub",
        color: g.color,
        r: 11,
        groupName: g.name,
      };
      graphNodes.push(hub);
      graphLinks.push({ source: root.id, target: hub.id, type: "root-hub" });
      g.pages.forEach((p) => {
        const r = 3 + Math.sqrt(Math.max(0, p.citations || 0)) * 2.4;
        graphNodes.push({
          id: "leaf::" + p.url,
          label: p.title || p.path,
          type: "leaf",
          color: g.color,
          r: Math.max(3, Math.min(14, r)),
          page: p,
          groupName: g.name,
        });
        graphLinks.push({
          source: hub.id,
          target: "leaf::" + p.url,
          type: "hub-leaf",
        });
      });
    });

    const svg = d3.select("#sitemapSvg");
    const wrap = document.querySelector(".sitemap-canvas");
    const W = wrap.clientWidth;
    const H = 540;
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("height", H);
    svg.selectAll("*").remove();

    // Grid background
    const defs = svg.append("defs");
    const pattern = defs
      .append("pattern")
      .attr("id", "sm-grid")
      .attr("width", 28)
      .attr("height", 28)
      .attr("patternUnits", "userSpaceOnUse");
    pattern
      .append("path")
      .attr("d", "M 28 0 L 0 0 0 28")
      .attr("fill", "none")
      .attr("stroke", "#eef0f3")
      .attr("stroke-width", 1);
    pattern
      .append("path")
      .attr("d", "M 13 14 L 15 14 M 14 13 L 14 15")
      .attr("fill", "none")
      .attr("stroke", "#dadde2")
      .attr("stroke-width", 1);
    svg
      .append("rect")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("fill", "url(#sm-grid)");

    const g = svg.append("g").attr("class", "sm-zoom-layer");

    const link = g
      .append("g")
      .attr("class", "sm-links")
      .selectAll("line")
      .data(graphLinks)
      .join("line")
      .attr("stroke", (d) => (d.type === "root-hub" ? "#cbd0d8" : "#e5e7eb"))
      .attr("stroke-width", (d) => (d.type === "root-hub" ? 1.2 : 0.8));

    const node = g
      .append("g")
      .attr("class", "sm-nodes")
      .selectAll("g")
      .data(graphNodes)
      .join("g")
      .attr("class", (d) => "sm-node sm-node-" + d.type)
      .style("cursor", (d) => (d.type === "leaf" ? "pointer" : "default"));

    // Invisible larger hitbox for reliable clicks on small leaves
    node
      .append("circle")
      .attr("class", "sm-hit")
      .attr("r", (d) => (d.type === "leaf" ? Math.max(d.r + 6, 12) : d.r + 4))
      .attr("fill", "transparent")
      .attr("pointer-events", "all");

    // Visible circle
    node
      .append("circle")
      .attr("class", "sm-visible")
      .attr("r", (d) => d.r)
      .attr("fill", (d) => {
        if (d.type === "leaf") {
          return d.page && d.page.citations > 0 ? d.color : "#ffffff";
        }
        return d.color;
      })
      .attr("stroke", (d) => {
        if (d.type === "hub") return "#ffffff";
        if (d.type === "leaf") {
          return d.page && d.page.citations === 0 ? d.color : "transparent";
        }
        return "transparent";
      })
      .attr("stroke-width", (d) => {
        if (d.type === "hub") return 2;
        if (d.type === "leaf" && d.page && d.page.citations === 0) return 1.5;
        return 0;
      })
      .attr("pointer-events", "none");

    node
      .filter((d) => d.type === "hub" || d.type === "root")
      .append("text")
      .attr("dy", (d) => d.r + 14)
      .attr("text-anchor", "middle")
      .attr("font-size", (d) => (d.type === "root" ? 12 : 11))
      .attr("font-weight", 600)
      .attr("fill", "#171717")
      .text((d) => d.label);

    // Hover tooltip + click-to-detail
    const tooltip = document.getElementById("sitemapTooltip");
    const detailEl = document.getElementById("sitemapDetail");
    const brandNames = (data.citation_footprint && data.citation_footprint.brand_names) || {};
    const ownBrandIdLocal = data.meta && data.meta.own_brand_id;

    function openDetail(d) {
      if (!d || !d.page) {
        // Safety: ignore clicks on hubs/root/empty space
        return;
      }
      const p = d.page;
      document.getElementById("smdGroup").textContent = d.groupName || "";
      document.getElementById("smdGroup").style.color = d.color;
      document.getElementById("smdTitle").textContent = p.title || p.path;
      const urlEl = document.getElementById("smdUrl");
      urlEl.textContent = p.url + " ↗";
      urlEl.href = p.url;
      const status = document.getElementById("smdStatus");
      if (p.citations > 0) {
        status.className = "sm-detail-status status-cited";
        status.textContent = "✓ Indexed and cited by AI";
      } else if (p.retrievals > 0) {
        status.className = "sm-detail-status status-retrieved";
        status.textContent = "⚠ Retrieved but not cited (AI rejected)";
      } else {
        status.className = "sm-detail-status status-absent";
        status.textContent = "Not seen by AI this window";
      }
      document.getElementById("smdCitations").textContent = p.citations || 0;
      document.getElementById("smdRetrievals").textContent = p.retrievals || 0;
      const rate = p.retrievals ? (p.citations / p.retrievals).toFixed(2) : "0";
      document.getElementById("smdRate").textContent = rate;
      document.getElementById("smdType").textContent = p.type || "OTHER";
      document.getElementById("smdPath").textContent = p.path;
      const alongside = (p.alongside || []).filter((id) => id !== ownBrandIdLocal);
      const wrap2 = document.getElementById("smdAlongsideWrap");
      const chipsEl = document.getElementById("smdAlongside");
      if (alongside.length) {
        wrap2.hidden = false;
        chipsEl.innerHTML = alongside
          .map((id) => `<span class="sm-detail-chip">${esc(brandNames[id] || id)}</span>`)
          .join("");
      } else {
        wrap2.hidden = true;
      }
      detailEl.hidden = false;
    }

    document.getElementById("smDetailClose").addEventListener("click", () => {
      detailEl.hidden = true;
    });

    node
      .filter((d) => d.type === "leaf")
      .on("mousemove", (event, d) => {
        const rect = wrap.getBoundingClientRect();
        tooltip.hidden = false;
        const status = d.page.citations > 0
          ? `<span style="color:#86efac">●</span> indexed`
          : `<span style="color:#fcd34d">●</span> retrieved only`;
        tooltip.innerHTML = `
          <div class="tt-title">${esc(d.label)}</div>
          <div class="tt-path">${esc(d.page.path)}</div>
          <div class="tt-meta"><strong>${d.page.citations}</strong> citations · <strong>${d.page.retrievals}</strong> retrievals · ${status}</div>
          <div class="tt-hint">click for full details</div>
        `;
        tooltip.style.left = event.clientX - rect.left + 14 + "px";
        tooltip.style.top = event.clientY - rect.top + 14 + "px";
      })
      .on("mouseleave", () => {
        tooltip.hidden = true;
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        openDetail(d);
      });

    const sim = d3
      .forceSimulation(graphNodes)
      .force(
        "link",
        d3
          .forceLink(graphLinks)
          .id((d) => d.id)
          .distance((d) => (d.type === "root-hub" ? 220 : 30))
          .strength((d) => (d.type === "root-hub" ? 0.5 : 1)),
      )
      .force(
        "charge",
        d3.forceManyBody().strength((d) => (d.type === "leaf" ? -40 : -260)),
      )
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force(
        "collide",
        d3.forceCollide().radius((d) => d.r + (d.type === "leaf" ? 2 : 8)),
      )
      .on("tick", () => {
        link
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);
        node.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });

    // Drag behavior
    node.call(
      d3
        .drag()
        .on("start", (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) sim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }),
    );

    // Zoom + pan
    const zoom = d3
      .zoom()
      .scaleExtent([0.4, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    document.getElementById("smZoomIn").onclick = () =>
      svg.transition().duration(200).call(zoom.scaleBy, 1.3);
    document.getElementById("smZoomOut").onclick = () =>
      svg.transition().duration(200).call(zoom.scaleBy, 1 / 1.3);
    document.getElementById("smReset").onclick = () =>
      svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
  }

  // ---------- DEEP CRAWL INSIGHTS ----------
  if (data.deepcrawl) {
    const dc = data.deepcrawl;
    document.getElementById("dcTitle").textContent = dc.title;
    document.getElementById("dcSubtitle").textContent = dc.subtitle;
    document.getElementById("dcIndexed").textContent = dc.stats.indexed;
    document.getElementById("dcRetrieved").textContent = dc.stats.retrieved_only;
    document.getElementById("dcRate").textContent = Math.round(dc.stats.indexing_rate * 100) + "%";

    // Page type performance — horizontal bars
    const pt = dc.page_type_performance;
    document.getElementById("dcPtTitle").textContent = pt.title;
    document.getElementById("dcPtSub").textContent = pt.subtitle;
    document.getElementById("dcPtInsight").textContent = pt.insight;
    const ptMax = Math.max(...pt.rows.map((r) => r.avg_citation_rate));
    document.getElementById("dcPageType").innerHTML = pt.rows
      .sort((a, b) => b.avg_citation_rate - a.avg_citation_rate)
      .map((r) => {
        const w = ((r.avg_citation_rate / ptMax) * 100).toFixed(0);
        return `
          <div class="dc-pt-row">
            <span class="dc-pt-label">${esc(r.type)}</span>
            <div class="dc-pt-bar"><div class="dc-pt-fill" style="width:${w}%"></div></div>
            <span class="dc-pt-rate">${r.avg_citation_rate.toFixed(2)}</span>
            <span class="dc-pt-pages">${r.pages} pages</span>
          </div>`;
      })
      .join("");

    // Locale performance
    const loc = dc.locale_performance;
    document.getElementById("dcLocaleTitle").textContent = loc.title;
    document.getElementById("dcLocaleSub").textContent = loc.subtitle;
    document.getElementById("dcLocaleInsight").textContent = loc.insight;
    const locMax = Math.max(...loc.rows.map((r) => r.share));
    document.getElementById("dcLocale").innerHTML = loc.rows
      .map((r) => {
        const w = ((r.share / locMax) * 100).toFixed(0);
        return `
          <div class="dc-locale-row">
            <span class="dc-locale-flag">${esc(r.locale)}</span>
            <div class="dc-locale-bar"><div class="dc-locale-fill" style="width:${w}%"></div></div>
            <span class="dc-locale-share">${Math.round(r.share * 100)}%</span>
            <span class="dc-locale-cites">${r.citations} cites</span>
          </div>`;
      })
      .join("");

    // Leaky pages
    const leaky = dc.leaky_pages;
    document.getElementById("dcLeakyTitle").textContent = leaky.title;
    document.getElementById("dcLeakySub").textContent = leaky.subtitle;
    document.getElementById("dcLeakyInsight").textContent = leaky.insight;
    document.getElementById("dcLeaky").innerHTML = leaky.rows
      .map(
        (r) => `
        <div class="dc-leaky-row">
          <div>
            <div class="dc-leaky-title">${esc(r.title)}</div>
            <div class="dc-leaky-path">${esc(r.path)}</div>
          </div>
          <div class="dc-leaky-meta">
            <span class="dc-leaky-type">${esc(r.type)}</span>
            <span><strong>${r.retrievals}</strong> retrievals</span>
            <span class="dc-leaky-zero"><strong>0</strong> citations</span>
          </div>
        </div>`,
      )
      .join("");

    // Topic coverage
    const tc = dc.topic_coverage;
    document.getElementById("dcTopicTitle").textContent = tc.title;
    document.getElementById("dcTopicSub").textContent = tc.subtitle;
    document.getElementById("dcTopicInsight").textContent = tc.insight;
    document.getElementById("dcTopic").innerHTML = tc.rows
      .map(
        (r) => `
        <div class="dc-topic-row dc-verdict-${r.verdict}">
          <span class="dc-topic-name">${esc(r.topic)}</span>
          <span class="dc-topic-count">${r.hp_pages_cited} hp.com page${r.hp_pages_cited === 1 ? "" : "s"} cited</span>
          <span class="dc-topic-verdict">${esc(r.verdict)}</span>
        </div>`,
      )
      .join("");
  }

  // ---------- STORYTELLERS ----------
  const storytellersEl = document.getElementById("storytellers");
  data.storytellers.forEach((s) => {
    const sourceTag =
      s.framing_source === "verified"
        ? `<span class="framing-source verified">Verified from chat text</span>`
        : `<span class="framing-source inferred">Inferred (not read)</span>`;
    const card = document.createElement("div");
    card.className = `storyteller-card st-${s.hp_framing}`;
    card.innerHTML = `
      <div class="st-head">
        <div class="st-pub"><span class="st-dot"></span>${esc(s.publication)}</div>
        <div class="st-class">${esc(s.classification)}</div>
      </div>
      <a class="st-article" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.article)}</a>
      <div class="st-framing-row">
        <span class="ev-badge-${s.hp_framing}">${esc(framingLabel[s.hp_framing] || s.hp_framing)}</span>
        ${sourceTag}
      </div>
      <div class="st-metrics">
        <span><strong>${s.retrievals}</strong> retrievals</span>
        <span><strong>${s.citations}</strong> citations</span>
      </div>
      <div class="st-effect">${esc(s.effect)}</div>
      <div class="st-action"><span class="st-label">Move</span> ${esc(s.action)}</div>
      <details class="st-details">
        <summary>Evidence</summary>
        <div class="st-evidence">${esc(s.framing_evidence)}</div>
      </details>
    `;
    storytellersEl.appendChild(card);
  });

  // ---------- THE ONE MOVE ----------
  const m = data.move;
  const p = m.pitch_template;
  const moveEl = document.getElementById("move");
  const renderPitch = p
    ? `
    <details class="pitch-details">
      <summary><span class="pitch-badge">Copy-send pitch template</span></summary>
      <div class="pitch">
        <div class="pitch-head">
          <span class="pitch-hint">Ready-to-send email to the editor</span>
          <button class="pitch-copy" id="pitchCopy" type="button">Copy</button>
        </div>
        <div class="pitch-field"><span class="pitch-label">To</span><span>${esc(p.to)}</span></div>
        <div class="pitch-field"><span class="pitch-label">Subject</span><span>${esc(p.subject)}</span></div>
        <pre class="pitch-body" id="pitchBody">${esc(p.body)}</pre>
        <div class="pitch-success"><span class="st-label">Success metric</span> ${esc(p.success_metric)}</div>
      </div>
    </details>`
    : "";
  moveEl.innerHTML = `
    <div class="move-head">${esc(m.headline)}</div>
    <div class="move-body">${esc(m.body)}</div>
    <div class="move-meta">
      <div><span class="move-label">Owner</span>${esc(m.owner)}</div>
      <div><span class="move-label">Timeline</span>${esc(m.timeline)}</div>
      <div><span class="move-label">Expected impact</span>${esc(m.expected_impact)}</div>
    </div>
    ${renderPitch}
  `;

  const copyBtn = document.getElementById("pitchCopy");
  if (copyBtn && p) {
    copyBtn.addEventListener("click", () => {
      const text = `Subject: ${p.subject}\nTo: ${p.to}\n\n${p.body}`;
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = "Copied";
        setTimeout(() => (copyBtn.textContent = "Copy"), 1800);
      });
    });
  }

  // ---------- DOWNLOAD PDF ----------
  const pdfBtn = document.getElementById("downloadPdf");
  if (pdfBtn) {
    pdfBtn.addEventListener("click", () => {
      const prevTitle = document.title;
      document.title = `Narrator - ${data.meta.brand} - ${data.meta.window_label}`;
      const detailEls = Array.from(document.querySelectorAll("details"));
      const previouslyOpen = detailEls.map((d) => d.open);
      detailEls.forEach((d) => (d.open = true));
      const onAfter = () => {
        detailEls.forEach((d, i) => (d.open = previouslyOpen[i]));
        document.title = prevTitle;
        window.removeEventListener("afterprint", onAfter);
      };
      window.addEventListener("afterprint", onAfter);
      setTimeout(() => window.print(), 150);
    });
  }

  // ---------- METHODOLOGY ----------
  const methEl = document.getElementById("methodology");
  const mth = data.methodology;
  methEl.innerHTML = `
    <div class="meth-title">${esc(mth.title)}</div>
    <div class="meth-list">
      ${mth.items
        .map(
          (it) => `
        <div class="meth-item">
          <span class="ev-badge-${it.label.toLowerCase()}">${esc(it.label)}</span>
          <span>${esc(it.desc)}</span>
        </div>`
        )
        .join("")}
    </div>
    <div class="meth-process">${esc(mth.process)}</div>
  `;
})();
