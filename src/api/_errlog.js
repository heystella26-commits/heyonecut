// 오류 기록: 최근 300건을 D1에 보관 (개인정보 없이 위치·메시지·기기 종류만)
import { getJSON, putJSON } from "./_store.js";
import { hashId } from "./_track.js";
export async function logError(where, msg, { id = null, ua = "", extra = null } = {}) {
  try {
    const dev = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mobile/.test(ua) ? "mobile" : ua ? "PC" : "server";
    const app = /KAKAOTALK/i.test(ua) ? " 카톡" : /Instagram/i.test(ua) ? " 인스타" : /NAVER/i.test(ua) ? " 네이버" : "";
    const list = (await getJSON("sys/errors")) || [];
    list.unshift({ at: Date.now(), where: String(where).slice(0, 40), msg: String(msg || "").slice(0, 300), dev: dev + app, who: hashId(id), extra: extra ? String(extra).slice(0, 200) : null });
    await putJSON("sys/errors", list.slice(0, 300));
  } catch {}
}
