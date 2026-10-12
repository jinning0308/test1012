
const form = document.querySelector("#stockSearchForm");
const stockCodeInput = document.querySelector("#stockCode");
const notice = document.querySelector("#notice");

const stockName = document.querySelector("#stockName");
const stockSymbol = document.querySelector("#stockSymbol");
const latestPrice = document.querySelector("#latestPrice");
const priceChange = document.querySelector("#priceChange");

const returnMetric = document.querySelector("#returnMetric");
const volatilityMetric = document.querySelector("#volatilityMetric");
const movingAverage = document.querySelector("#movingAverage");
const modelStatus = document.querySelector("#modelStatus");

const chartCanvas = document.querySelector("#priceChart");

let priceChart = null;

// 這些是「示範資料」，不是即時行情，也不是 AI 真實預測。
const demoStocks = {
  "2330": {
    name: "台積電",
    basePrice: 1050,
    drift: 0.0015,
    volatility: 0.018
  },
  "2317": {
    name: "鴻海",
    basePrice: 210,
    drift: 0.0008,
    volatility: 0.022
  },
  "2454": {
    name: "聯發科",
    basePrice: 1350,
    drift: 0.001,
    volatility: 0.02
  },
  "0050": {
    name: "元大台灣50",
    basePrice: 190,
    drift: 0.0007,
    volatility: 0.012
  }
};

function makeDemoHistory(stock) {
  const prices = [];
  let price = stock.basePrice * 0.91;

  // 產生 60 個展示用的歷史價格點。
  for (let i = 0; i < 60; i += 1) {
    const movement = (Math.random() - 0.48) * stock.volatility;
    price *= 1 + stock.drift + movement;
    prices.push(Number(price.toFixed(2)));
  }

  return prices;
}

function makeDemoForecast(lastPrice, stock) {
  const forecast = [null, ...Array(59).fill(null), lastPrice];
  let price = lastPrice;

  // 產生 10 個展示用的預測點，不代表模型輸出。
  for (let i = 0; i < 10; i += 1) {
    const movement = stock.drift + (Math.random() - 0.5) * stock.volatility * 0.7;
    price *= 1 + movement;
    forecast.push(Number(price.toFixed(2)));
  }

  return forecast;
}

function calculateReturn(prices) {
  if (prices.length < 2) return 0;
  return (prices[prices.length - 1] / prices[0] - 1) * 100;
}

function calculateVolatility(prices) {
  const returns = [];

  for (let i = 1; i < prices.length; i += 1) {
    returns.push(prices[i] / prices[i - 1] - 1);
  }

  if (returns.length === 0) return 0;

  const average = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce(
    (sum, value) => sum + (value - average) ** 2,
    0
  ) / returns.length;

  // 此處顯示的是日報酬率標準差，非年化波動度。
  return Math.sqrt(variance) * 100;
}

function calculateMovingAverage(prices, period = 20) {
  const recent = prices.slice(-period);
  return recent.reduce((sum, value) => sum + value, 0) / recent.length;
}

function formatPrice(value) {
  return new Intl.NumberFormat("zh-TW", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function renderChart(history, forecast) {
  const labels = [
    ...Array.from({ length: history.length }, (_, i) => `第 ${i + 1} 日`),
    ...Array.from({ length: 10 }, (_, i) => `預測 +${i + 1} 日`)
  ];

  const historicalData = [
    ...history,
    ...Array(10).fill(null)
  ];

  // 預測線從最後一個歷史價格點開始銜接。
  const forecastData = [
    ...Array(history.length - 1).fill(null),
    history[history.length - 1],
    ...forecast.slice(-10)
  ];

  if (priceChart) {
    priceChart.destroy();
  }

  priceChart = new Chart(chartCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "歷史股價（示範）",
          data: historicalData,
          borderColor: "#8e73dc",
          backgroundColor: "rgba(142, 115, 220, 0.10)",
          borderWidth: 2.5,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0.25,
          fill: true,
          spanGaps: false
        },
        {
          label: "未來走勢（示意，非 AI 預測）",
          data: forecastData,
          borderColor: "#e4a0c7",
          backgroundColor: "rgba(228, 160, 199, 0.08)",
          borderWidth: 2.5,
          borderDash: [7, 6],
          pointRadius: 2,
          pointHoverRadius: 5,
          tension: 0.25,
          fill: false,
          spanGaps: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: "#302b3d",
          padding: 12,
          callbacks: {
            label(context) {
              if (context.raw === null) return "";
              return `${context.dataset.label}：${formatPrice(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#a19aaa",
            maxTicksLimit: 8,
            maxRotation: 0
          },
          border: { display: false }
        },
        y: {
          grid: { color: "#f0ebf5" },
          ticks: {
            color: "#a19aaa",
            callback(value) {
              return Number(value).toLocaleString("zh-TW");
            }
          },
          border: { display: false }
        }
      }
    }
  });
}

function analyzeStock(rawCode) {
  const code = rawCode.trim();

  if (!/^[0-9A-Za-z.-]{1,10}$/.test(code)) {
    notice.textContent = "請輸入有效的股票代號，例如 2330。";
    return;
  }

  const stock = demoStocks[code];

  if (!stock) {
    notice.textContent =
      `目前沒有 ${code} 的示範設定。正式版接入行情資料後，才能查詢更多股票。`;
    return;
  }

  const history = makeDemoHistory(stock);
  const lastPrice = history[history.length - 1];
  const forecast = makeDemoForecast(lastPrice, stock);

  const totalReturn = calculateReturn(history);
  const volatility = calculateVolatility(history);
  const average20 = calculateMovingAverage(history);

  stockName.textContent = stock.name;
  stockSymbol.textContent = `示範代號：${code}`;
  latestPrice.textContent = formatPrice(lastPrice);

  priceChange.textContent =
    `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%（60 點示範資料累積變化）`;

  priceChange.style.color = totalReturn >= 0 ? "#a16aa7" : "#8b78bd";

  returnMetric.textContent = `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`;
  volatilityMetric.textContent = `${volatility.toFixed(2)}%`;
  movingAverage.textContent = formatPrice(average20);
  modelStatus.textContent = "尚未訓練";

  notice.textContent =
    "展示模式：價格為隨機產生的示範資料，不是真實行情；粉紅虛線是隨機走勢示意，不是 AI 預測。";

  renderChart(history, forecast);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  analyzeStock(stockCodeInput.value);
});

// 預設顯示台積電示範畫面。
analyzeStock("2330");