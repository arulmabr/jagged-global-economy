(async function () {
  const DATA_URL = "assets/interactive_data.json?v=release-safe-20260515";
  const BLUE = "#1f5f8b";
  const TEAL = "#3b8f7b";
  const GOLD = "#b6812e";
  const RED = "#aa4a44";
  const GRAY = "#5f6368";
  const ADOPTION_PLOT_HEIGHT = 340;

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
      line: { color, width: 2 },
      hoverinfo: "skip",
    };
  }

  async function renderNationalExposure(data) {
    const rows = data.nationalExposure;
    await plot(
      "plot-national-exposure",
      [
        {
          type: "choropleth",
          locationmode: "ISO-3",
          locations: rows.map((row) => row.countryCode),
          z: rows.map((row) => row.exposure),
          text: rows.map((row) => row.countryName),
          customdata: rows.map((row) => [
            row.region,
            row.incomeGroup,
            row.employmentK,
            row.population2024,
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
            "Region: %{customdata[0]}<br>" +
            "Income group: %{customdata[1]}<br>" +
            "Employment: %{customdata[2]:,.0f}k<br>" +
            "Population 2024: %{customdata[3]:,.0f}<extra></extra>",
        },
      ],
      baseLayout({
        margin: { l: 0, r: 0, t: 0, b: 0 },
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
  }

  async function renderLaborComposition(data) {
    const composition = data.laborComposition;
    const countries = composition.countries.map((row) => row.countryName).reverse();
    const colors = [BLUE, GOLD, TEAL, GRAY];
    const traces = composition.categories.map((category, index) => {
      const values = composition.countries.map((row) => row.shares[category]).reverse();
      return {
        type: "bar",
        orientation: "h",
        name: category,
        y: countries,
        x: values,
        marker: { color: colors[index] },
        customdata: values.map((value) => [category, value]),
        hovertemplate: "<b>%{y}</b><br>%{customdata[0]}: %{customdata[1]:.1f}%<extra></extra>",
      };
    });
    await plot(
      "plot-labor-composition",
      traces,
      baseLayout({
        barmode: "stack",
        margin: { l: 116, r: 20, t: 20, b: 48 },
        xaxis: { title: "Employment share (%)", range: [0, 100], ticksuffix: "%" },
        yaxis: { automargin: true },
        legend: { orientation: "h", y: -0.18 },
      })
    );
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
        xaxis: { title: "White-collar employment share (%)", ticksuffix: "%" },
        yaxis: { title: "National AI exposure" },
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
    const fit = scatterFitTrace(series.fit, "Fit", RED, series.isLogScale ? {} : { yMin: 0 });
    const traces = [
      {
        type: "scatter",
        mode: "markers",
        name: title,
        x: rows.map((row) => row.exposure),
        y: rows.map((row) => row.value),
        text: rows.map((row) => row.countryName),
        customdata: rows.map((row) => [row.countryCode]),
        marker: { color: BLUE, size: 8, opacity: 0.78, line: { color: "white", width: 0.5 } },
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
      baseLayout({
        autosize: true,
        height: ADOPTION_PLOT_HEIGHT,
        margin: { l: 64, r: 14, t: 38, b: 58 },
        title: { text: title, font: { size: 15 } },
        xaxis: { title: "National AI exposure" },
        yaxis: {
          title: yTitle,
          type: series.isLogScale ? "log" : "linear",
          rangemode: series.isLogScale ? undefined : "tozero",
        },
        annotations: [
          {
            xref: "paper",
            yref: "paper",
            x: 0.04,
            y: 0.95,
            showarrow: false,
            align: "left",
            bgcolor: "rgba(255,255,255,0.86)",
            bordercolor: "#dadce0",
            borderpad: 5,
            text:
              series.spearmanRho !== undefined
                ? `ρs = ${series.spearmanRho.toFixed(2)}<br>n = ${Math.round(series.nCountries)}`
                : "",
          },
        ],
        showlegend: false,
      })
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
        xaxis: { title: "Direct national AI exposure", range: [min, max] },
        yaxis: { title: "Remittance-accounted national AI exposure", range: [min, max] },
        showlegend: false,
      })
    );
  }

  try {
    const data = await loadData();
    await Promise.all([
      renderNationalExposure(data),
      renderLaborComposition(data),
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
      renderRemittance(data),
    ]);
  } catch (error) {
    document.documentElement.classList.add("plot-error");
    console.warn("Interactive plots were not rendered; static fallbacks remain visible.", error);
  }
})();
