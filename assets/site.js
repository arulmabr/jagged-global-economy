(async function () {
  const DATA_URL = "assets/interactive_data.json?v=layout-polish-20260520";
  const FONT_FAMILY = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  const BLUE = "#246b8f";
  const RED = "#b44f2a";
  const GRID = "#e4e7eb";
  const AXIS = "#c5ccd4";
  const SOURCE_TEXT = "Source: Jagged Global Economy (2026)";
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
    "plot-adoption-anthropic": {
      filename: "jagged-global-economy-anthropic-adoption",
      label: "Anthropic adoption chart",
      width: 900,
      height: 620,
    },
    "plot-adoption-openai": {
      filename: "jagged-global-economy-openai-adoption",
      label: "OpenAI adoption chart",
      width: 900,
      height: 620,
    },
    "plot-adoption-microsoft": {
      filename: "jagged-global-economy-microsoft-adoption",
      label: "Microsoft adoption chart",
      width: 900,
      height: 620,
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

  function formatEmployment(thousands) {
    if (thousands === null || thousands === undefined || Number.isNaN(thousands)) return "n/a";
    if (thousands >= 1000) return `${compactNumber(thousands / 1000, 1)}m`;
    return `${compactNumber(thousands, 0)}k`;
  }

  function titleCase(value) {
    if (!value) return "n/a";
    return String(value).replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }

  function baseLayout(extra = {}) {
    return {
      margin: { l: 64, r: 24, t: 28, b: 58 },
      paper_bgcolor: "white",
      plot_bgcolor: "white",
      font: { family: FONT_FAMILY, size: 13, color: "#202124" },
      hoverlabel: {
        bgcolor: "white",
        bordercolor: "#dadce0",
        font: { family: FONT_FAMILY, color: "#202124" },
      },
      ...extra,
    };
  }

  function cartesianAxis(extra = {}) {
    return {
      showline: true,
      linewidth: 1,
      linecolor: AXIS,
      gridcolor: GRID,
      zeroline: false,
      ticks: "outside",
      ticklen: 3,
      tickcolor: AXIS,
      tickfont: { size: 12, color: "#2f3439" },
      titlefont: { size: 13 },
      automargin: true,
      ...extra,
    };
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
    target.insertBefore(controls, el);
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
    };
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
        family: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
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
    return {
      title: yTitle,
      type: "linear",
      range: [0, 70],
      tickmode: "array",
      tickvals: [0, 20, 40, 60],
      ticktext: ["0", "20", "40", "60"],
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

  function updateCountryInspector(country) {
    const root = document.getElementById("country-inspector");
    if (!root || !country) return;
    root.classList.add("is-loaded");

    const name = document.getElementById("inspector-country");
    const meta = document.getElementById("inspector-meta");
    const exposure = document.getElementById("inspector-exposure");
    const employment = document.getElementById("inspector-employment");
    const occupations = document.getElementById("inspector-occupations");

    if (name) name.textContent = country.countryName;
    if (meta) {
      meta.textContent =
        `${country.region} · ${titleCase(country.incomeGroup)} · ${titleCase(country.reliability)} Reliability · ${country.countryCode}`;
    }
    if (exposure) exposure.textContent = country.exposure?.toFixed(3) || "n/a";
    if (employment) employment.textContent = `${formatEmployment(country.totalEmploymentK)} workers`;
    if (!occupations) return;

    occupations.replaceChildren();
    const topOccupations = country.topOccupations || [];
    if (!topOccupations.length) {
      const item = document.createElement("li");
      item.textContent = "No occupation contribution rows are available for this country.";
      occupations.append(item);
      return;
    }

    topOccupations.forEach((occupation) => {
      const item = document.createElement("li");
      const main = document.createElement("span");
      main.className = "occupation-main";
      const code = document.createElement("span");
      code.className = "occupation-code";
      code.textContent = `(ISCO ${occupation.iscoCode})`;
      main.append(document.createTextNode(`${occupation.label} `), code);
      const detail = document.createElement("span");
      detail.className = "occupation-meta";
      detail.textContent =
        `${formatPercent(occupation.employmentSharePct)} workers · ` +
        `exposure ${occupation.exposureScore.toFixed(3)} · ` +
        `${formatPercent(occupation.contributionPct)} score`;
      item.append(main, detail);
      occupations.append(item);
    });
  }

  async function renderNationalExposure(data) {
    const rows = data.nationalExposure;
    const explorer = data.countryExplorer || {};
    const el = await plot(
      "plot-national-exposure",
      [
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
          colorscale: [
            [0, "#f2f5f3"],
            [0.35, "#a8c7b8"],
            [0.7, "#3a83a0"],
            [1, "#123f5a"],
          ],
          marker: { line: { color: "rgba(255,255,255,0.6)", width: 0.35 } },
          colorbar: { title: "Exposure", thickness: 14, len: 0.78 },
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
    updateCountryInspector(explorer.USA || explorer[rows[0]?.countryCode]);
    el.style.cursor = "pointer";
    el.on("plotly_hover", () => {
      el.style.cursor = "pointer";
    });
    el.on("plotly_unhover", () => {
      el.style.cursor = "pointer";
    });
    el.on("plotly_click", (event) => {
      const countryCode = event?.points?.[0]?.location;
      updateCountryInspector(explorer[countryCode]);
    });
  }

  async function renderWhiteCollar(data) {
    const wc = data.whiteCollar;
    const rows = wc.points;
    const fit = scatterFitTrace(wc.fit, "Linear fit", RED);
    const traces = [
      {
        type: "scatter",
        mode: "markers",
        name: "Countries",
        x: rows.map((row) => row.wcSharePct),
        y: rows.map((row) => row.exposure),
        text: rows.map((row) => row.countryName),
        customdata: rows.map((row) => [row.countryCode, row.region, row.incomeGroup, row.employmentK]),
        marker: {
          color: rows.map((row) => row.exposure),
          colorscale: [
            [0, "#dbe8ff"],
            [0.45, "#6f8ff2"],
            [1, "#0b2aa8"],
          ],
          size: 8,
          opacity: 0.82,
          line: { color: "white", width: 0.5 },
          colorbar: { title: "Exposure", thickness: 12 },
        },
        hovertemplate:
          "<b>%{text}</b> (%{customdata[0]})<br>" +
          "White-collar share: %{x:.1f}%<br>" +
          "Exposure: %{y:.3f}<br>" +
          "Region: %{customdata[1]}<br>" +
          "Income group: %{customdata[2]}<br>" +
          "Employment: %{customdata[3]:,.0f}k<extra></extra>",
      },
    ];
    if (fit) traces.push(fit);

    const r2 = wc.metrics["White-collar share only"]?.rSquared;
    await plot(
      "plot-white-collar",
      traces,
      baseLayout({
        margin: { l: 64, r: 72, t: 28, b: 72 },
        xaxis: cartesianAxis({
          title: "White-collar employment share (%)",
          ticksuffix: "%",
        }),
        yaxis: cartesianAxis({
          title: "National AI exposure",
        }),
        annotations: [
          {
            xref: "paper",
            yref: "paper",
            x: 0.03,
            y: 0.96,
            showarrow: false,
            align: "left",
            bgcolor: "rgba(255,255,255,0.86)",
            bordercolor: "#dadce0",
            borderpad: 6,
            text: r2 ? `White-collar share R² = ${r2.toFixed(2)}` : "",
          },
        ],
        showlegend: false,
      })
    );
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
    await plot(
      "plot-remittance",
      [
        {
          type: "scatter",
          mode: "lines",
          name: "Equal exposure",
          x: [min, max],
          y: [min, max],
          line: { color: "#9aa0a6", width: 1.5, dash: "dash" },
          hoverinfo: "skip",
        },
        {
          type: "scatter",
          mode: "markers",
          name: "Countries",
          x: rows.map((row) => row.domesticExposure),
          y: rows.map((row) => row.remittanceExposure),
          text: rows.map((row) => row.countryName),
          customdata: rows.map((row) => [
            row.countryCode,
            row.remittancePctGdp,
            row.sourceShareCovered,
            row.totalInflowM,
          ]),
          marker: {
            color: rows.map((row) => row.remittancePctGdp),
            colorscale: "YlOrRd",
            size: rows.map((row) => Math.max(8, Math.min(22, row.remittancePctGdp / 2.2))),
            opacity: 0.82,
            line: { color: "white", width: 0.7 },
            colorbar: { title: "Remittance<br>% GDP", thickness: 12 },
          },
          hovertemplate:
            "<b>%{text}</b> (%{customdata[0]})<br>" +
            "Direct exposure: %{x:.3f}<br>" +
            "Remittance-accounted exposure: %{y:.3f}<br>" +
            "Remittance: %{customdata[1]:.1f}% GDP<br>" +
            "Source share covered: %{customdata[2]:.1%}<br>" +
            "Total inflow: $%{customdata[3]:,.0f}m<extra></extra>",
        },
      ],
      baseLayout({
        margin: { l: 64, r: 72, t: 28, b: 72 },
        xaxis: cartesianAxis({ title: "Direct national AI exposure", range: [min, max] }),
        yaxis: cartesianAxis({ title: "Remittance-accounted national AI exposure", range: [min, max] }),
        showlegend: false,
      })
    );
  }

  try {
    const data = await loadData();
    await Promise.all([
      renderNationalExposure(data),
      renderWhiteCollar(data),
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
  } catch (error) {
    document.documentElement.classList.add("plot-error");
    console.warn("Interactive plots were not rendered; static fallbacks remain visible.", error);
  }
})();
