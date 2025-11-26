// server.js
// run: npm init -y
// npm i express node-fetch cheerio

import express from "express";
import fetch from "node-fetch";
import cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

/*
  NOTE:
  - 下の各 URL は実際に確認できる時刻表ページへ向けています（ソース参照）。
  - HTML 構造はサイト更新で変わる可能性が高いため、セレクタは適宜調整してください。
*/

// --- JR: 西川原就実駅（例：JR駅ページ or 検索結果ページ） ---
const JR_STATION_URL = "https://www.jr-odekake.net/eki/top.php?id=0650631"; // 西川原（JR）
const JR_TRAFFIC_URL = "https://trafficinfo.westjr.co.jp/chugoku.html"; // 運行情報（中国エリア）

// --- 宇野自動車（岡山中央警察署前） ---
const UNO_STOP_URL = "https://www.unobus.co.jp/bustei/672.html"; // 実際の停留所ページ（例）

// --- 岡電：浜本町 ---
const OKADEN_HAMAMOTO_URL = "https://www.jorudan.co.jp/bus/rosen/timetable/%E6%B5%9C%E6%9C%AC%E7%94%BA%E3%80%94%E5%B2%A1%E5%B1%B1%E9%9B%BB%E6%B0%97%E8%BB%8C%E9%81%93%E3%80%95/"; // 参考

async function fetchHTML(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible)" }});
  const text = await res.text();
  return cheerio.load(text);
}

// Helper: parse "HH:MM" -> minutes since midnight
function hmToMinutes(hm) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

// --- JR endpoint: return array of {time, dest, notes} and delay info ---
app.get("/api/jr", async (req, res) => {
  try {
    const $ = await fetchHTML(JR_STATION_URL);

    // サイトによって時刻表の構造が違うので以下は *例* セレクタです。要調整。
    const result = [];

    // Example: find table rows that include time and destination (this will need tuning)
    $("table.timetable tr").each((i, el) => {
      const time = $(el).find(".time").text().trim();
      const dest = $(el).find(".destination").text().trim();
      if (time) result.push({ time, dest });
    });

    // 遅延情報を別ページから取得
    const $t = await fetchHTML(JR_TRAFFIC_URL);
    // こちらもページ構成に合わせてセレクタを調整
    const trafficNotice = $t("body").text().includes("遅れ") ? $t("body").text().slice(0, 800) : null;

    res.json({ ok: true, station: "西川原就実", timetable: result, traffic: trafficNotice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// --- UNO (宇野自動車) endpoint ---
app.get("/api/uno", async (req, res) => {
  try {
    const $ = await fetchHTML(UNO_STOP_URL);
    const list = [];

    // 停留所ページのHTML構造に合わせてパース
    $(".timetable tr").each((i, el) => {
      const cols = $(el).find("td");
      if (cols.length >= 2){
        const time = $(cols[0]).text().trim();
        const dest = $(cols[1]).text().trim();
        if (time) list.push({ time, dest });
      }
    });

    res.json({ ok: true, stop: "岡山中央警察署前", timetable: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// --- OKADEN (浜本町) endpoint ---
app.get("/api/okaden/hamamoto", async (req, res) => {
  try {
    const $ = await fetchHTML(OKADEN_HAMAMOTO_URL);
    const list = [];

    // Jorudanなどの時刻表はテーブルがあるはず。要セレクタ調整
    $("table.timetable tr").each((i, el) => {
      const time = $(el).find("td.time").text().trim();
      const dest = $(el).find("td.dest").text().trim();
      if (time) list.push({ time, dest });
    });

    res.json({ ok: true, stop: "浜本町", timetable: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.listen(PORT, () => console.log(`API server running on ${PORT}`));
