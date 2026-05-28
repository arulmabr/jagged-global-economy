(async function () {
  const DATA_URL = "assets/interactive_data.json?v=remittance-labels-20260528";
  const FONT_FAMILY = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  const BLUE = "#1f4b7a";
  const RED = "#8b2332";
  const INK = "#1a1a1a";
  const MUTED = "#555f69";
  const QUIET = "#7b8490";
  const GRID = "#e8ebef";
  const AXIS = "#d1d6dc";
  const SOURCE_TEXT = "Source: Jagged Global Economy (2026)";
  const FACTOR_COLORS = {
    wcSharePct: "#1f4b7a",
    internetPct: "#8b2332",
    logGni: "#60723c",
    cmpNational: "#6f5d85",
  };
  const FACTOR_LABELS = {
    cmpNational: "Task profile",
  };
  const FACTOR_DESCRIPTIONS = {
    wcSharePct: "Share of workers in white-collar occupations (ISCO 1-4).",
    internetPct: "Share of people using the internet.",
    logGni: "Gross national income per person, adjusted for purchasing power.",
    cmpNational:
      "Countries score higher when more workers are in jobs with cognitive, computer, document, and information-processing tasks; they score lower when work is more physical or manual.",
  };
  const COMBINED_FACTOR_DESCRIPTION =
    "Multiple active buttons are combined by averaging each country's percentile across the selected factors.";
  const EXPOSURE_COLORSCALE = [
    [0, "#f2f5f3"],
    [0.35, "#a8c7b8"],
    [0.7, "#3a83a0"],
    [1, "#123f5a"],
  ];
  const ADOPTION_PLOT_HEIGHT = 360;
  const ADOPTION_X_RANGE = [0.14, 0.38];
  const ADOPTION_X_TICKS = [0.15, 0.2, 0.25, 0.3, 0.35];
  const EXPORT_OPTIONS = {
    "plot-national-exposure": {
      filename: "jagged-global-economy-national-exposure-map",
      label: "national exposure map",
      width: 1400,
      height: 850,
    },
    "plot-white-collar": {
      filename: "jagged-global-economy-white-collar-exposure",
      label: "white-collar exposure chart",
      width: 1200,
      height: 760,
    },
    "plot-remittance": {
      filename: "jagged-global-economy-remittance-exposure",
      label: "remittance exposure chart",
      width: 1200,
      height: 760,
    },
  };
  const ADOPTION_MARKER = {
    color: BLUE,
    size: 8,
    opacity: 0.78,
    line: { color: "white", width: 0.5 },
  };
  const ADOPTION_FIT_LINE = { color: RED, width: 2 };
  let plotlyApi = null;
  let countryExplorer = {};
  let currentCountryCode = null;
  let occupationSort = "employment";
  let exposureFactors = new Set(["wcSharePct"]);

  const config = {
    responsive: true,
    displaylogo: false,
    displayModeBar: false,
    scrollZoom: false,
    doubleClick: "reset",
  };

  function compactNumber(value, digits = 1) {
    if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
    return Number(value).toLocaleString(undefined, {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    });
  }

  function formatPercent(value, digits = 1) {
    if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
    return `${Number(value).toFixed(digits)}%`;
  }

  function hasNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function formatExposure(value) {
    return hasNumber(value) ? value.toFixed(3) : "n/a";
  }

  function formatEmployment(thousands) {
    if (thousands === null || thousands === undefined || Number.isNaN(thousands)) return "n/a";
    if (thousands >= 1000) return `${compactNumber(thousands / 1000, 1)}m`;
    return `${compactNumber(thousands, 0)}k`;
  }

  function ordinal(value) {
    const rounded = Math.round(value);
    const mod100 = rounded % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${rounded}th`;
    const mod10 = rounded % 10;
    if (mod10 === 1) return `${rounded}st`;
    if (mod10 === 2) return `${rounded}nd`;
    if (mod10 === 3) return `${rounded}rd`;
    return `${rounded}th`;
  }

  function titleCase(value) {
    if (!value) return "n/a";
    return String(value).replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }

  function describeDelta(delta) {
    if (!hasNumber(delta)) return null;
    if (Math.abs(delta) < 0.001) return "about the same as";
    return `${Math.abs(delta).toFixed(3)} ${delta > 0 ? "above" : "below"}`;
  }

  function comparisonPhrase(delta, peerLabel) {
    if (!hasNumber(delta)) return null;
    if (Math.abs(delta) < 0.005) return `Near ${peerLabel} average`;
    return delta > 0 ? `Above ${peerLabel} average` : `Below ${peerLabel} average`;
  }

  function reliabilityLabel(value) {
    if (!value) return null;
    return `${titleCase(value)} data reliability`;
  }

  function adoptionLabel(sourceKey) {
    return {
      anthropic: "Anthropic Claude",
      signals: "OpenAI Signals",
      microsoft: "Microsoft AI Diffusion",
    }[sourceKey] || titleCase(sourceKey);
  }

  function formatAdoptionValue(sourceKey, value) {
    if (!hasNumber(value)) return "n/a";
    if (sourceKey === "signals") return `${ordinal(value * 100)} percentile`;
    if (sourceKey === "microsoft") return `${value.toFixed(1)}% WAP`;
    if (sourceKey === "anthropic") return `${compactNumber(value, 1)} / 100k WAP`;
    return compactNumber(value, 2);
  }

  function formatFactorValue(key, value, predictor) {
    if (!hasNumber(value)) return "n/a";
    if (predictor.tickSuffix === "%") return `${value.toFixed(1)}%`;
    if (key === "logGni") return value.toFixed(2);
    return value.toFixed(2);
  }

  function factorLabel(key, predictor = {}) {
    return FACTOR_LABELS[key] || predictor.label || titleCase(key);
  }

  function baseLayout(extra = {}) {
    return {
      margin: { l: 64, r: 24, t: 28, b: 58 },
      paper_bgcolor: "white",
      plot_bgcolor: "white",
      font: { family: FONT_FAMILY, size: 13, color: INK },
      hoverlabel: {
        bgcolor: "white",
        bordercolor: AXIS,
        font: { family: FONT_FAMILY, color: INK },
      },
      ...extra,
    };
  }

  function cartesianAxis(extra = {}) {
    return {
      showline: false,
      linewidth: 0,
      linecolor: "rgba(0,0,0,0)",
      gridcolor: GRID,
      zeroline: false,
      ticks: "",
      ticklen: 0,
      tickcolor: AXIS,
      tickfont: { family: FONT_FAMILY, size: 12, color: MUTED },
      titlefont: { family: FONT_FAMILY, size: 13, color: INK },
      automargin: true,
      ...extra,
    };
  }

  function exposureColorbar(extra = {}) {
    return {
      title: {
        text: "Exposure score",
        side: "top",
        font: { size: 11, color: "#2f3439" },
      },
      tickfont: { size: 11, color: "#2f3439" },
      outlinecolor: AXIS,
      outlinewidth: 1,
      ...extra,
    };
  }

  function updateExposureLegend(min, mid, max) {
    [
      ["legend-exposure-min", min],
      ["legend-exposure-mid", mid],
      ["legend-exposure-max", max],
    ].forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value.toFixed(2);
    });
  }

  async function loadData() {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Could not load ${DATA_URL}: ${response.status}`);
    return response.json();
  }

  function markReady(id) {
    const el = document.getElementById(id);
    const figure = el && el.closest(".interactive-figure");
    if (figure) figure.classList.add("plot-ready");
  }

  function getPlotly() {
    if (plotlyApi) return plotlyApi;
    if (window.Plotly) return window.Plotly;
    if (typeof Plotly !== "undefined") return Plotly;
    return null;
  }

  function nextFrame() {
    return new Promise((resolve) => {
      if (window.requestAnimationFrame) {
        window.requestAnimationFrame(() => resolve());
        return;
      }
      window.setTimeout(resolve, 0);
    });
  }

  async function downloadPlotImage(el, options) {
    const plotly = getPlotly();
    if (!plotly) throw new Error("Plotly export API is unavailable");
    const currentAnnotations = Array.isArray(el.layout?.annotations)
      ? el.layout.annotations.slice()
      : [];
    const exportAnnotations = [...currentAnnotations, sourceAnnotation()];
    if (typeof plotly.relayout === "function") {
      await plotly.relayout(el, { annotations: exportAnnotations });
    }
    try {
      if (typeof plotly.downloadImage === "function") {
        return await plotly.downloadImage(el, options);
      }
      if (typeof plotly.toImage !== "function") {
        throw new Error("Plotly image export is unavailable");
      }

      const imageUrl = await plotly.toImage(el, options);
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `${options.filename}.${options.format}`;
      document.body.append(link);
      link.click();
      link.remove();
      return undefined;
    } finally {
      if (typeof plotly.relayout === "function") {
        await plotly.relayout(el, { annotations: currentAnnotations });
      }
    }
  }

  function addDownloadControls(id, el) {
    const figure = el.closest(".interactive-figure");
    const target = el.parentElement;
    const options = EXPORT_OPTIONS[id];
    if (!figure || !target || !options || target.querySelector(".figure-downloads")) return;

    const controls = document.createElement("div");
    controls.className = "figure-downloads";

    const actions = document.createElement("span");
    actions.className = "figure-download-actions";
    ["png"].forEach((format) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Download PNG";
      button.title = `Download ${options.label} as ${format.toUpperCase()}`;
      button.addEventListener("click", async () => {
        const previous = button.textContent;
        button.disabled = true;
        button.textContent = "...";
        try {
          await downloadPlotImage(el, {
            format,
            filename: options.filename,
            width: options.width,
            height: options.height,
            scale: 2,
          });
        } catch (error) {
          console.warn("Figure export failed", error);
          button.textContent = "Retry";
          return;
        } finally {
          button.disabled = false;
        }
        button.textContent = previous;
      });
      actions.append(button);
    });

    controls.append(actions);
    target.append(controls);
  }

  async function plot(id, traces, layout) {
    const plotly = getPlotly();
    if (!plotly) throw new Error("Plotly failed to load");
    plotlyApi = plotly;
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing plot element: ${id}`);
    const figure = el.closest(".interactive-figure");
    if (figure) figure.classList.add("plot-rendering");
    await plotly.newPlot(el, traces, layout, config);
    addDownloadControls(id, el);
    if (figure) figure.classList.remove("plot-rendering");
    markReady(id);
    if (plotly.Plots?.resize) {
      nextFrame()
        .then(() => plotly.Plots.resize(el))
        .catch((error) => console.warn("Plot resize failed", error));
    }
    return el;
  }

  function scatterFitTrace(fit, name, color, options = {}) {
    if (!fit || !fit.points || fit.points.length < 2) return null;
    let points = fit.points;
    if (options.yMin !== undefined && fit.slope) {
      const yMin = options.yMin;
      points = [...points];
      if (points[0].y < yMin) {
        points[0] = { x: (yMin - fit.intercept) / fit.slope, y: yMin };
      }
      if (points[points.length - 1].y < yMin) {
        points[points.length - 1] = { x: (yMin - fit.intercept) / fit.slope, y: yMin };
      }
      points = points.filter((point) => point.y >= yMin);
      if (points.length < 2) return null;
    }
    return {
      type: "scatter",
      mode: "lines",
      name,
      x: points.map((point) => point.x),
      y: points.map((point) => point.y),
      line: options.line || { color, width: 2 },
      hoverinfo: "skip",
      showlegend: options.showlegend !== undefined ? options.showlegend : true,
    };
  }

  function linearFitClient(points, xKey, yKey) {
    const clean = points
      .map((point) => ({ x: point[xKey], y: point[yKey] }))
      .filter((point) => hasNumber(point.x) && hasNumber(point.y));
    if (clean.length < 2) return { points: [], slope: null, intercept: null };
    const xMean = clean.reduce((sum, point) => sum + point.x, 0) / clean.length;
    const yMean = clean.reduce((sum, point) => sum + point.y, 0) / clean.length;
    const denom = clean.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0);
    if (denom === 0) return { points: [], slope: null, intercept: null };
    const slope = clean.reduce(
      (sum, point) => sum + (point.x - xMean) * (point.y - yMean),
      0
    ) / denom;
    const intercept = yMean - slope * xMean;
    const xMin = Math.min(...clean.map((point) => point.x));
    const xMax = Math.max(...clean.map((point) => point.x));
    return {
      points: [
        { x: xMin, y: intercept + slope * xMin },
        { x: xMax, y: intercept + slope * xMax },
      ],
      slope,
      intercept,
    };
  }

  function rSquaredClient(points, xKey, yKey) {
    const clean = points
      .map((point) => ({ x: point[xKey], y: point[yKey] }))
      .filter((point) => hasNumber(point.x) && hasNumber(point.y));
    if (clean.length < 2) return null;
    const xMean = clean.reduce((sum, point) => sum + point.x, 0) / clean.length;
    const yMean = clean.reduce((sum, point) => sum + point.y, 0) / clean.length;
    const xSS = clean.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0);
    const ySS = clean.reduce((sum, point) => sum + (point.y - yMean) ** 2, 0);
    if (xSS === 0 || ySS === 0) return null;
    const xy = clean.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0);
    return (xy ** 2) / (xSS * ySS);
  }

  function adoptionAxis(extra = {}) {
    return cartesianAxis(extra);
  }

  function adoptionAnnotation(series) {
    return {
      xref: "paper",
      yref: "paper",
      x: 0.045,
      y: 0.94,
      showarrow: false,
      align: "left",
      bgcolor: "rgba(255,255,255,0.88)",
      bordercolor: "#dadce0",
      borderwidth: 1,
      borderpad: 5,
      font: { size: 12 },
      text:
        series.spearmanRho !== undefined
          ? `ρ<sub>s</sub> = ${series.spearmanRho.toFixed(2)}<br>n = ${Math.round(series.nCountries)}`
          : "",
    };
  }

  function sourceAnnotation(options = {}) {
    return {
      xref: "paper",
      yref: "paper",
      x: options.x ?? 1,
      y: options.y ?? 0.02,
      xanchor: options.xanchor || "right",
      yanchor: options.yanchor || "bottom",
      showarrow: false,
      align: options.align || "right",
      text: SOURCE_TEXT,
      font: {
        family: FONT_FAMILY,
        size: options.size || 10,
        color: "#73777c",
      },
      bgcolor: "rgba(255,255,255,0.74)",
      borderpad: 1,
    };
  }

  function adoptionYOptions(series, yTitle) {
    if (series.isLogScale) {
      return {
        title: yTitle,
        type: "log",
        range: [-0.35, 2.35],
        tickmode: "array",
        tickvals: [1, 3, 10, 30, 100, 200],
        ticktext: ["1", "3", "10", "30", "100", "200"],
      };
    }
    if (yTitle.includes("Rank percentile")) {
      return {
        title: yTitle,
        type: "linear",
        range: [0, 1.08],
        tickmode: "array",
        tickvals: [0, 0.25, 0.5, 0.75, 1],
        ticktext: ["0", "0.25", "0.50", "0.75", "1.00"],
      };
    }
    const maxValue = Math.max(...series.points.map((point) => point.value).filter(Number.isFinite));
    const yMax = Math.max(80, Math.ceil((maxValue * 1.12) / 5) * 5);
    return {
      title: yTitle,
      type: "linear",
      range: [0, yMax],
      tickmode: "array",
      tickvals: [0, 20, 40, 60, 80],
      ticktext: ["0", "20", "40", "60", "80"],
    };
  }

  function adoptionLayout(series, title, yTitle) {
    const yOptions = adoptionYOptions(series, yTitle);
    if (typeof yOptions.title === "string") {
      yOptions.title = { text: yOptions.title, standoff: 12 };
    }

    return baseLayout({
      autosize: true,
      height: ADOPTION_PLOT_HEIGHT,
      margin: { l: 88, r: 14, t: 38, b: 70 },
      title: { text: title, font: { size: 15 }, x: 0.5, xanchor: "center" },
      xaxis: adoptionAxis({
        title: "National AI exposure",
        range: ADOPTION_X_RANGE,
        tickmode: "array",
        tickvals: ADOPTION_X_TICKS,
        tickformat: ".2f",
      }),
      yaxis: adoptionAxis(yOptions),
      annotations: [adoptionAnnotation(series)],
      showlegend: false,
    });
  }

  function populateCountrySelector(defaultCountryCode) {
    const selector = document.getElementById("country-selector");
    if (!selector) return;
    selector.replaceChildren();
    Object.values(countryExplorer)
      .sort((a, b) => a.countryName.localeCompare(b.countryName))
      .forEach((country) => {
        const option = document.createElement("option");
        option.value = country.countryCode;
        option.textContent = country.countryName;
        selector.append(option);
      });
    selector.value = defaultCountryCode;
    if (selector.dataset.bound === "true") return;
    selector.dataset.bound = "true";
    selector.addEventListener("change", () => {
      selectCountry(selector.value);
    });
  }

  function setSelectedCountry(countryCode) {
    const selector = document.getElementById("country-selector");
    if (selector && selector.value !== countryCode) selector.value = countryCode;
  }

  function selectCountry(countryCode) {
    const country = countryExplorer[countryCode];
    if (!country) return;
    currentCountryCode = countryCode;
    setSelectedCountry(countryCode);
    updateCountryInspector(country);
  }

  function peerLabelFromIncome(value) {
    if (!value) return "income group";
    return String(value)
      .toLowerCase()
      .replace("high income", "high-income")
      .replace("upper middle income", "upper-middle-income")
      .replace("lower middle income", "lower-middle-income")
      .replace("low income", "low-income");
  }

  function appendComparison(parent, label, value) {
    if (!label) return;
    const item = document.createElement("span");
    item.className = "comparison-pill";
    item.textContent = value ? `${label} (${value})` : label;
    parent.append(item);
  }

  function renderComparison(country) {
    const target = document.getElementById("inspector-comparison");
    if (!target) return;
    target.replaceChildren();
    appendComparison(
      target,
      comparisonPhrase(country.incomeExposureDelta, peerLabelFromIncome(country.incomeGroup)),
      formatExposure(country.incomeAverageExposure)
    );
    appendComparison(
      target,
      comparisonPhrase(country.regionExposureDelta, country.region),
      formatExposure(country.regionAverageExposure)
    );
  }

  function appendSnapshotCard(parent, title, body, meta = "", extraNode = null) {
    if (!body && !extraNode) return;
    const card = document.createElement("article");
    card.className = "snapshot-card";
    const heading = document.createElement("span");
    heading.className = "snapshot-label";
    heading.textContent = title;
    const strong = document.createElement("strong");
    strong.textContent = body || "";
    card.append(heading, strong);
    if (meta) {
      const note = document.createElement("span");
      note.className = "snapshot-note";
      note.textContent = meta;
      card.append(note);
    }
    if (extraNode) card.append(extraNode);
    parent.append(card);
  }

  function renderLaborSplit(labor) {
    if (!hasNumber(labor.whiteCollarSharePct)) return null;
    const blueShare = Math.max(0, 100 - labor.whiteCollarSharePct);
    const wrap = document.createElement("span");
    wrap.className = "labor-split";
    const bar = document.createElement("span");
    bar.className = "labor-split-bar";
    const wc = document.createElement("span");
    wc.className = "labor-split-wc";
    wc.style.width = `${Math.max(0, Math.min(100, labor.whiteCollarSharePct))}%`;
    bar.append(wc);
    const labels = document.createElement("span");
    labels.className = "labor-split-labels";
    labels.textContent = `Remaining ${formatPercent(blueShare)} non-white-collar workers`;
    wrap.append(bar, labels);
    return wrap;
  }

  function renderSnapshot(country) {
    const target = document.getElementById("inspector-snapshot");
    if (!target) return;
    target.replaceChildren();

    const labor = country.laborStructure || {};
    appendSnapshotCard(
      target,
      "Labor composition",
      hasNumber(labor.whiteCollarSharePct) ? `${formatPercent(labor.whiteCollarSharePct)} white-collar` : "",
      hasNumber(labor.whiteCollarExposure) && hasNumber(labor.blueCollarExposure)
        ? `Exposure: white-collar ${formatExposure(labor.whiteCollarExposure)}, non-white-collar ${formatExposure(labor.blueCollarExposure)}`
        : "",
      renderLaborSplit(labor)
    );

    const gender = country.gender;
    if (gender && hasNumber(gender.gap)) {
      const direction = gender.gap >= 0 ? "Women higher" : "Men higher";
      appendSnapshotCard(
        target,
        "Gender",
        `${direction} by ${Math.abs(gender.gap).toFixed(3)}`,
        `Women ${formatExposure(gender.femaleExposure)} · men ${formatExposure(gender.maleExposure)}`
      );
    }

    const adoption = country.adoption || {};
    const adoptionEntries = Object.entries(adoption);
    if (adoptionEntries.length) {
      const chips = document.createElement("span");
      chips.className = "mini-chip-row";
      adoptionEntries.forEach(([sourceKey, observation]) => {
        const chip = document.createElement("span");
        chip.className = "mini-chip";
        chip.textContent = `${adoptionLabel(sourceKey)}: ${formatAdoptionValue(sourceKey, observation.value)}`;
        chips.append(chip);
      });
      appendSnapshotCard(target, "Observed adoption", "Validation data available", "", chips);
    }
  }

  function renderOccupationBars(country) {
    const occupations = document.getElementById("inspector-occupations");
    if (!occupations) return;
    occupations.replaceChildren();
    const rows =
      occupationSort === "contribution"
        ? country.topOccupationsByContribution || country.topOccupations || []
        : country.topOccupationsByEmployment || country.topOccupations || [];

    if (!rows.length) {
      const item = document.createElement("li");
      item.textContent = "No occupation contribution rows are available for this country.";
      occupations.append(item);
      return;
    }

    const valueKey = occupationSort === "contribution" ? "contributionPct" : "employmentSharePct";
    const maxValue = Math.max(...rows.map((occupation) => occupation[valueKey] || 0), 1);
    rows.forEach((occupation) => {
      const item = document.createElement("li");
      const main = document.createElement("span");
      main.className = "occupation-main";
      const code = document.createElement("span");
      code.className = "occupation-code";
      code.textContent = `(ISCO ${occupation.iscoCode})`;
      main.append(document.createTextNode(`${occupation.label} `), code);

      const barRow = document.createElement("span");
      barRow.className = "occupation-bar-row";
      const track = document.createElement("span");
      track.className = "occupation-track";
      const bar = document.createElement("span");
      bar.className = "occupation-bar";
      bar.style.width = `${Math.max(3, ((occupation[valueKey] || 0) / maxValue) * 100)}%`;
      track.append(bar);
      const value = document.createElement("span");
      value.className = "occupation-value";
      value.textContent =
        occupationSort === "contribution"
          ? `${formatPercent(occupation.contributionPct)} of score`
          : `${formatPercent(occupation.employmentSharePct)} workers`;
      barRow.append(track, value);

      const detail = document.createElement("span");
      detail.className = "occupation-meta";
      detail.textContent =
        `Occupation exposure ${formatExposure(occupation.exposureScore)} · ` +
        `Workers ${formatPercent(occupation.employmentSharePct)} · ` +
        `Score contribution ${formatPercent(occupation.contributionPct)} of national score`;

      item.append(main, barRow, detail);
      occupations.append(item);
    });
  }

  function updateOccupationSortButtons() {
    document.querySelectorAll("[data-occupation-sort]").forEach((button) => {
      const selected = button.dataset.occupationSort === occupationSort;
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function bindOccupationSortButtons() {
    document.querySelectorAll("[data-occupation-sort]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        occupationSort = button.dataset.occupationSort || "employment";
        updateOccupationSortButtons();
        if (currentCountryCode && countryExplorer[currentCountryCode]) {
          renderOccupationBars(countryExplorer[currentCountryCode]);
        }
      });
    });
    updateOccupationSortButtons();
  }

  function updateCountryInspector(country) {
    const root = document.getElementById("country-inspector");
    if (!root || !country) return;
    root.classList.add("is-loaded");

    const name = document.getElementById("inspector-country");
    const meta = document.getElementById("inspector-meta");
    const exposure = document.getElementById("inspector-exposure");
    const exposureNote = document.getElementById("inspector-exposure-note");
    const employment = document.getElementById("inspector-employment");

    if (name) name.textContent = country.countryName;
    if (meta) {
      meta.textContent = [
        country.region,
        titleCase(country.incomeGroup),
        reliabilityLabel(country.reliability),
      ]
        .filter((value) => value && value !== "n/a")
        .join(" · ");
    }
    if (exposure) exposure.textContent = formatExposure(country.exposure);
    if (exposureNote) {
      const rankText = country.exposureRank ? `#${country.exposureRank} of ${country.nCountries}` : "";
      const percentileText = hasNumber(country.exposurePercentile)
        ? `${ordinal(country.exposurePercentile)} percentile`
        : "";
      exposureNote.textContent = [rankText, percentileText].filter(Boolean).join(" · ");
    }
    if (employment) employment.textContent = formatEmployment(country.totalEmploymentK);
    bindOccupationSortButtons();
    renderOccupationBars(country);
    renderComparison(country);
    renderSnapshot(country);
  }

  async function renderNationalExposure(data) {
    const rows = data.nationalExposure;
    const missingRows = data.missingCountries || [];
    countryExplorer = data.countryExplorer || {};
    const exposureValues = rows.map((row) => row.exposure).filter((value) => Number.isFinite(value));
    const exposureMin = exposureValues.length ? Math.min(...exposureValues) : 0;
    const exposureMax = exposureValues.length ? Math.max(...exposureValues) : 1;
    const exposureMid = (exposureMin + exposureMax) / 2;
    updateExposureLegend(exposureMin, exposureMid, exposureMax);
    const el = await plot(
      "plot-national-exposure",
      [
        {
          type: "choropleth",
          locationmode: "ISO-3",
          locations: missingRows.map((row) => row.countryCode),
          z: missingRows.map(() => 0),
          text: missingRows.map((row) => row.countryName),
          colorscale: [
            [0, "#d9dde3"],
            [1, "#d9dde3"],
          ],
          showscale: false,
          marker: { line: { color: "rgba(255,255,255,0.75)", width: 0.35 } },
          hovertemplate:
            "<b>%{text}</b><br>" +
            "No exposure estimate due to missing data<extra></extra>",
        },
        {
          type: "choropleth",
          locationmode: "ISO-3",
          locations: rows.map((row) => row.countryCode),
          z: rows.map((row) => row.exposure),
          text: rows.map((row) => row.countryName),
          customdata: rows.map((row) => [
            row.countryCode,
            row.region,
            row.incomeGroup,
            row.employmentK,
          ]),
          colorscale: EXPOSURE_COLORSCALE,
          zmin: exposureMin,
          zmax: exposureMax,
          marker: { line: { color: "rgba(255,255,255,0.6)", width: 0.35 } },
          showscale: false,
          hovertemplate:
            "<b>%{text}</b><br>" +
            "Exposure: %{z:.3f}<br>" +
            "Region: %{customdata[1]}<br>" +
            "Income group: %{customdata[2]}<br>" +
            "Employment: %{customdata[3]:,.0f}k<extra></extra>",
        },
      ],
      baseLayout({
        margin: { l: 0, r: 0, t: 0, b: 8 },
        geo: {
          projection: { type: "natural earth" },
          lataxis: { range: [-58, 84] },
          showframe: false,
          showcoastlines: false,
          showland: true,
          landcolor: "#e8eaed",
          showcountries: true,
          countrycolor: "white",
          bgcolor: "white",
        },
      })
    );
    const defaultCountryCode = countryExplorer.USA ? "USA" : rows[0]?.countryCode;
    populateCountrySelector(defaultCountryCode);
    selectCountry(defaultCountryCode);
    el.on("plotly_click", (event) => {
      const countryCode = event?.points?.[0]?.location;
      selectCountry(countryCode);
    });
  }

  function updateExposureFactorButtons() {
    document.querySelectorAll("[data-exposure-factor]").forEach((button) => {
      const selected = exposureFactors.has(button.dataset.exposureFactor);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function updateFactorDescription(data) {
    const target = document.getElementById("factor-description");
    const predictors = data?.exposureDrivers?.predictors || {};
    if (!target) return;

    const selectedKeys = Object.keys(predictors).filter((key) => exposureFactors.has(key));
    target.replaceChildren();
    if (selectedKeys.length > 1) {
      const labels = selectedKeys.map((key) => factorLabel(key, predictors[key]));
      const card = document.createElement("article");
      card.className = "factor-description-card";
      card.style.setProperty("--factor-color", BLUE);

      const title = document.createElement("strong");
      title.textContent = "Combined predictor";

      const text = document.createElement("span");
      text.textContent = `${COMBINED_FACTOR_DESCRIPTION} Selected factors: ${labels.join(", ")}.`;

      card.append(title, text);
      target.append(card);
      return;
    }

    selectedKeys.forEach((key) => {
      const predictor = predictors[key];
      const card = document.createElement("article");
      card.className = "factor-description-card";
      card.style.setProperty("--factor-color", FACTOR_COLORS[key] || BLUE);

      const title = document.createElement("strong");
      title.textContent = factorLabel(key, predictor);

      const text = document.createElement("span");
      text.textContent = FACTOR_DESCRIPTIONS[key] || predictor?.note || "";

      card.append(title, text);
      target.append(card);
    });
  }

  function bindExposureFactorButtons(data) {
    document.querySelectorAll("[data-exposure-factor]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", async () => {
        const key = button.dataset.exposureFactor || "wcSharePct";
        if (exposureFactors.has(key)) {
          exposureFactors.delete(key);
        } else {
          exposureFactors.add(key);
        }
        if (exposureFactors.size === 0) exposureFactors.add("wcSharePct");
        updateExposureFactorButtons();
        updateFactorDescription(data);
        await renderExposureDrivers(data);
      });
    });
    updateExposureFactorButtons();
    updateFactorDescription(data);
  }

  async function renderExposureDrivers(data) {
    const drivers = data.exposureDrivers || {};
    const selectedKeys = Object.keys(drivers.predictors || {}).filter((key) => exposureFactors.has(key));
    const isCombined = selectedKeys.length > 1;
    const completeRows = (drivers.points || []).filter(
      (row) => hasNumber(row.exposure) && selectedKeys.every((key) => hasNumber(row[key]))
    );
    const percentileMaps = {};
    selectedKeys.forEach((key) => {
      const sortedValues = [...completeRows].sort((a, b) => a[key] - b[key]);
      percentileMaps[key] = new Map(
        sortedValues.map((row, rank) => [
          row.countryCode,
          sortedValues.length > 1 ? (rank / (sortedValues.length - 1)) * 100 : 50,
        ])
      );
    });

    const points = completeRows.map((row) => {
      const percentiles = selectedKeys.map((key) => percentileMaps[key].get(row.countryCode));
      const predictorPercentile =
        percentiles.reduce((sum, value) => sum + value, 0) / Math.max(percentiles.length, 1);
      return {
        ...row,
        predictorPercentile,
        factorDetails: selectedKeys
          .map((key, index) => {
            const predictor = drivers.predictors[key];
            const label = factorLabel(key, predictor);
            const value = formatFactorValue(key, row[key], predictor);
            return `${label}: ${value} (${percentiles[index].toFixed(0)}th pct.)`;
          })
          .join("<br>"),
      };
    });

    const primaryKey = selectedKeys[0];
    const primaryPredictor = drivers.predictors[primaryKey] || {};
    const traceName = isCombined ? "Combined predictor" : factorLabel(primaryKey, primaryPredictor);
    const percentileLabel = isCombined ? "Combined predictor percentile" : `${traceName} percentile`;
    const color = isCombined ? BLUE : FACTOR_COLORS[primaryKey] || BLUE;
    const fit = scatterFitTrace(
      linearFitClient(points, "predictorPercentile", "exposure"),
      "Fit",
      color,
      { line: { color, width: 2.3 }, showlegend: false }
    );
    const traces = [
      {
        type: "scatter",
        mode: "markers",
        name: traceName,
        x: points.map((row) => row.predictorPercentile),
        y: points.map((row) => row.exposure),
        text: points.map((row) => row.countryName),
        cliponaxis: false,
        customdata: points.map((row) => [
          row.countryCode,
          row.region,
          row.incomeGroup,
          row.factorDetails,
        ]),
        marker: {
          color,
          size: 7.5,
          opacity: 0.82,
          line: { color: "white", width: 0.7 },
        },
        hovertemplate:
          "<b>%{text}</b> (%{customdata[0]})<br>" +
          "%{customdata[3]}<br>" +
          `${percentileLabel}: %{x:.0f}<br>` +
          "Exposure: %{y:.3f}<br>" +
          "Region: %{customdata[1]}<br>" +
          "Income group: %{customdata[2]}<extra></extra>",
      },
    ];
    if (fit) traces.push(fit);

    const metricNotes = [];
    if (isCombined) {
      const combinedR2 = rSquaredClient(points, "predictorPercentile", "exposure");
      if (hasNumber(combinedR2)) {
        metricNotes.push(`Combined predictor (${selectedKeys.length} factors) R² = ${combinedR2.toFixed(2)}`);
      }
    } else {
      const metric = drivers.metrics?.[primaryKey];
      if (metric?.rSquared) metricNotes.push(`${traceName} R² = ${metric.rSquared.toFixed(2)}`);
    }
    const annotations = metricNotes.length
      ? [
          {
            xref: "paper",
            yref: "paper",
            x: 0.03,
            y: 0.96,
            showarrow: false,
            align: "left",
            bgcolor: "rgba(255,255,255,0.92)",
            bordercolor: AXIS,
            borderpad: 6,
            font: { family: FONT_FAMILY, size: 12, color: INK },
            text: metricNotes.join("<br>"),
          },
        ]
      : [];

    await plot(
      "plot-white-collar",
      traces,
      baseLayout({
        margin: { l: 64, r: 72, t: 28, b: 72 },
        xaxis: cartesianAxis({
          title: percentileLabel,
          range: [0, 102.5],
          tickmode: "array",
          tickvals: [0, 20, 40, 60, 80, 100],
          ticksuffix: "",
        }),
        yaxis: cartesianAxis({
          title: "National AI exposure",
        }),
        annotations,
        showlegend: false,
      })
    );
    bindExposureFactorButtons(data);
  }

  async function renderAdoptionPanel(id, series, title, yTitle) {
    const rows = series.points;
    const fit = scatterFitTrace(
      series.fit,
      "Fit",
      RED,
      series.isLogScale ? { line: ADOPTION_FIT_LINE } : { yMin: 0, line: ADOPTION_FIT_LINE }
    );
    const traces = [
      {
        type: "scatter",
        mode: "markers",
        name: title,
        x: rows.map((row) => row.exposure),
        y: rows.map((row) => row.value),
        text: rows.map((row) => row.countryName),
        customdata: rows.map((row) => [row.countryCode]),
        marker: ADOPTION_MARKER,
        cliponaxis: true,
        hovertemplate:
          "<b>%{text}</b> (%{customdata[0]})<br>" +
          "Exposure: %{x:.3f}<br>" +
          `${yTitle}: %{y:.3f}<extra></extra>`,
      },
    ];
    if (fit) traces.push(fit);
    await plot(
      id,
      traces,
      adoptionLayout(series, title, yTitle)
    );
  }

  async function renderRemittance(data) {
    const rows = data.remittance.points;
    const exposures = rows.flatMap((row) => [row.domesticExposure, row.remittanceExposure]);
    const min = Math.min(...exposures) - 0.01;
    const max = Math.max(...exposures) + 0.01;
    const labeledCountries = new Set(["TJK", "HND", "GTM", "SLV", "TON", "LBN", "MNE"]);
    const pointLabel = (countryCode) => {
      return labeledCountries.has(countryCode) ? countryCode : "";
    };
    const labelPositions = {
      TJK: "middle right",
      HND: "top left",
      GTM: "bottom right",
      SLV: "top center",
      TON: "top right",
      LBN: "middle left",
      MNE: "bottom left",
    };
    await plot(
      "plot-remittance",
      [
        {
          type: "scatter",
          mode: "lines",
          name: "Equal exposure",
          x: [min, max],
          y: [min, max],
          line: { color: "rgba(85, 95, 105, 0.5)", width: 1.2, dash: "dash" },
          hoverinfo: "skip",
        },
        {
          type: "scatter",
          mode: "markers+text",
          name: "Countries",
          x: rows.map((row) => row.domesticExposure),
          y: rows.map((row) => row.remittanceExposure),
          text: rows.map((row) => pointLabel(row.countryCode)),
          textposition: rows.map((row) => labelPositions[row.countryCode] || "top center"),
          textfont: { family: FONT_FAMILY, size: 11, color: INK },
          cliponaxis: false,
          customdata: rows.map((row) => [
            row.countryCode,
            row.countryName,
            row.remittancePctGdp,
            row.sourceShareCovered,
            row.totalInflowM,
          ]),
          marker: {
            color: rows.map((row) => row.remittancePctGdp),
            colorscale: [
              [0, "#d9e9e4"],
              [0.38, "#78b7ae"],
              [0.72, "#2f8199"],
              [1, "#123f5a"],
            ],
            size: rows.map((row) => Math.max(7, Math.min(17, row.remittancePctGdp / 2.8))),
            opacity: 0.86,
            line: { color: "white", width: 0.7 },
            colorbar: {
              title: { text: "Remittance<br>(% GDP)", font: { family: FONT_FAMILY, size: 12, color: MUTED } },
              thickness: 10,
              tickfont: { family: FONT_FAMILY, size: 11, color: MUTED },
              outlinecolor: AXIS,
            },
          },
          hovertemplate:
            "<b>%{customdata[1]}</b> (%{customdata[0]})<br>" +
            "Direct exposure: %{x:.3f}<br>" +
            "Remittance-accounted exposure: %{y:.3f}<br>" +
            "Remittance: %{customdata[2]:.1f}% GDP<br>" +
            "Source share covered: %{customdata[3]:.1%}<br>" +
            "Total inflow: $%{customdata[4]:,.0f}m<extra></extra>",
        },
      ],
      baseLayout({
        margin: { l: 64, r: 72, t: 18, b: 72 },
        xaxis: cartesianAxis({ title: "Direct national AI exposure", range: [min, max] }),
        yaxis: cartesianAxis({ title: "Remittance-accounted national AI exposure", range: [min, max] }),
        shapes: [
          {
            type: "path",
            xref: "x",
            yref: "y",
            path: `M ${min},${min} L ${min},${max} L ${max},${max} Z`,
            fillcolor: "rgba(31, 75, 122, 0.055)",
            line: { width: 0 },
            layer: "below",
          },
        ],
        annotations: [
          {
            xref: "x",
            yref: "y",
            x: min + (max - min) * 0.16,
            y: max - (max - min) * 0.08,
            text: "Remittances raise exposure",
            showarrow: false,
            align: "left",
            bgcolor: "rgba(255,255,255,0.82)",
            bordercolor: "rgba(31,75,122,0.18)",
            borderpad: 5,
            font: { family: FONT_FAMILY, size: 12, color: BLUE },
          },
        ],
        showlegend: false,
      })
    );
  }

  function bindAdoptionDownload() {
    const wrap = document.getElementById("adoption-downloads");
    const button = document.getElementById("download-adoption-pngs");
    if (!wrap || !button || button.dataset.bound === "true") return;
    wrap.classList.add("is-visible");
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const previous = button.textContent;
      button.disabled = true;
      button.textContent = "Downloading...";
      const ids = [
        ["plot-adoption-anthropic", "jagged-global-economy-anthropic-adoption"],
        ["plot-adoption-openai", "jagged-global-economy-openai-adoption"],
        ["plot-adoption-microsoft", "jagged-global-economy-microsoft-adoption"],
      ];
      try {
        for (const [id, filename] of ids) {
          const el = document.getElementById(id);
          if (!el) continue;
          await downloadPlotImage(el, {
            format: "png",
            filename,
            width: 900,
            height: 620,
            scale: 2,
          });
        }
      } catch (error) {
        console.warn("Adoption figure export failed", error);
        button.textContent = "Retry download";
        return;
      } finally {
        button.disabled = false;
      }
      button.textContent = previous;
    });
  }

  try {
    const data = await loadData();
    await Promise.all([
      renderNationalExposure(data),
      renderExposureDrivers(data),
      renderAdoptionPanel(
        "plot-adoption-anthropic",
        data.adoption.anthropic,
        "Anthropic Claude usage",
        "Claude usage / 100k WAP"
      ),
      renderAdoptionPanel(
        "plot-adoption-openai",
        data.adoption.signals,
        "OpenAI Signals",
        "Rank percentile"
      ),
      renderAdoptionPanel(
        "plot-adoption-microsoft",
        data.adoption.microsoft,
        "Microsoft AI Diffusion",
        "MS adoption (% WAP)"
      ),
      renderRemittance(data),
    ]);
    bindAdoptionDownload();
  } catch (error) {
    document.documentElement.classList.add("plot-error");
    console.warn("Interactive plots were not rendered; static fallbacks remain visible.", error);
  }
})();
