(async function () {
  const DATA_URL = "assets/interactive_data.json?v=atlas-feedback-20260518";
  const BLUE = "#1f5f8b";
  const RED = "#aa4a44";
  const GRID = "#e8eaed";
  const AXIS = "#9aa0a6";
  const SOURCE_TEXT = "Source: Murugan et al. (2026), The Jagged Global Economy";
  const ADOPTION_PLOT_HEIGHT = 340;
  const ADOPTION_X_RANGE = [0.14, 0.38];
  const ADOPTION_X_TICKS = [0.15, 0.2, 0.25, 0.3, 0.35];
  const ADOPTION_MARKER = {
    color: BLUE,
    size: 8,
    opacity: 0.78,
    line: { color: "white", width: 0.5 },
  };
  const ADOPTION_FIT_LINE = { color: RED, width: 2 };

  const config = {
    responsive: true,
    displaylogo: false,
    scrollZoom: false,
    doubleClick: "reset",
    modeBarButtonsToRemove: [
      "toImage",
      "pan2d",
      "zoomIn2d",
      "zoomOut2d",
      "autoScale2d",
      "select2d",
      "lasso2d",
    ],
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

  function baseLayout(extra = {}) {
    return {
      margin: { l: 64, r: 24, t: 28, b: 58 },
      paper_bgcolor: "white",
      plot_bgcolor: "white",
      font: { family: "Georgia, Times New Roman, serif", size: 13, color: "#202124" },
      hoverlabel: { bgcolor: "white", bordercolor: "#dadce0", font: { color: "#202124" } },
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

  async function plot(id, traces, layout) {
    if (!window.Plotly) throw new Error("Plotly failed to load");
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing plot element: ${id}`);
    const figure = el.closest(".interactive-figure");
    if (figure) figure.classList.add("plot-rendering");
    await Plotly.newPlot(el, traces, layout, config);
    if (figure) figure.classList.remove("plot-rendering");
    markReady(id);
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
    return {
      showline: true,
      linewidth: 1,
      linecolor: AXIS,
      gridcolor: GRID,
      zeroline: false,
      ticks: "outside",
      ticklen: 3,
      tickcolor: AXIS,
      tickfont: { size: 12 },
      titlefont: { size: 14 },
      ...extra,
    };
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
      y: options.y ?? -0.16,
      xanchor: options.xanchor || "right",
      yanchor: options.yanchor || "top",
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
    return baseLayout({
      autosize: true,
      height: ADOPTION_PLOT_HEIGHT,
      margin: { l: 64, r: 14, t: 38, b: 70 },
      title: { text: title, font: { size: 15 }, x: 0.5, xanchor: "center" },
      xaxis: adoptionAxis({
        title: "National AI exposure",
        range: ADOPTION_X_RANGE,
        tickmode: "array",
        tickvals: ADOPTION_X_TICKS,
        tickformat: ".2f",
      }),
      yaxis: adoptionAxis(adoptionYOptions(series, yTitle)),
      annotations: [adoptionAnnotation(series), sourceAnnotation({ y: -0.25, size: 9 })],
      showlegend: false,
    });
  }

  function updateCountryInspector(country) {
    const root = document.getElementById("country-inspector");
    if (!root || !country) return;

    const name = document.getElementById("inspector-country");
    const meta = document.getElementById("inspector-meta");
    const exposure = document.getElementById("inspector-exposure");
    const employment = document.getElementById("inspector-employment");
    const occupations = document.getElementById("inspector-occupations");

    if (name) name.textContent = country.countryName;
    if (meta) {
      meta.textContent = `${country.region} · ${country.incomeGroup} · ${country.reliability} reliability`;
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
      main.textContent = `ISCO ${occupation.iscoCode}: ${occupation.label}`;
      const detail = document.createElement("span");
      detail.className = "occupation-meta";
      detail.textContent =
        `${formatPercent(occupation.employmentSharePct)} of employment · ` +
        `exposure ${occupation.exposureScore.toFixed(3)} · ` +
        `${formatPercent(occupation.contributionPct)} of national score`;
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
            [0, "#edf3ee"],
            [0.35, "#9bc8b3"],
            [0.7, "#2c7da0"],
            [1, "#08306b"],
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
        annotations: [
          sourceAnnotation({
            x: 0.01,
            y: 0.02,
            xanchor: "left",
            yanchor: "bottom",
            align: "left",
            size: 11,
          }),
        ],
      })
    );
    updateCountryInspector(explorer.USA || explorer[rows[0]?.countryCode]);
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
          colorscale: "Blues",
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
        xaxis: {
          title: "White-collar employment share (%)",
          ticksuffix: "%",
          zeroline: false,
          gridcolor: GRID,
        },
        yaxis: {
          title: "National AI exposure",
          zeroline: false,
          gridcolor: GRID,
        },
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
          sourceAnnotation({ y: -0.16 }),
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
        xaxis: { title: "Direct national AI exposure", range: [min, max] },
        yaxis: { title: "Remittance-accounted national AI exposure", range: [min, max] },
        annotations: [sourceAnnotation({ y: -0.16 })],
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
        "MS GenAI adoption (% WAP)"
      ),
      renderRemittance(data),
    ]);
  } catch (error) {
    document.documentElement.classList.add("plot-error");
    console.warn("Interactive plots were not rendered; static fallbacks remain visible.", error);
  }
})();
