// ===== 基础类型
function addStatsGroup(g) {
    stats.addStatsGroup(JSON.stringify(g));
}
const STATS_EXT_PREFIX = "Ext::";
function setScriptButtons(buttons) {
    const buttonsStr = JSON.stringify(buttons);
    base.setScriptButtons(buttonsStr);
}
function httpAsyncCallback(tc, req, okChecker, o) {
    return httpClient.asyncCallback(tc, JSON.stringify(req), okChecker, (o) ? JSON.stringify(o) : JSON.stringify({}));
}
function httpSyncCall(tc, req, okChecker, o) {
    return httpClient.syncCall(tc, JSON.stringify(req), okChecker, (o) ? JSON.stringify(o) : JSON.stringify({}));
}
