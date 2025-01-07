//实体拦截器：【物料入库】创建前根据用户 ID 决定起点库位，并设置请求入库与入库单号的全局变量
function decideFromBinByUserBeforeCreating(tc, em, evList) {
    base.logDebug(tc, `decideFromBinByUserBeforeCreating evList = ${base.jsonToString(evList)}`);
    const ev = evList[0];
    const userId = ev.createdBy;
    const orderId = ev.id;
    const qty = ev["qty"];
    base.logDebug(tc, `decideFromBinByUserBeforeCreating,userId = ${userId}`);
    const userName = entity.findOneById(tc, "HumanUser", userId, null).username;
    base.logDebug(tc, `decideFromBinByUserBeforeCreating,userName = ${userName}`);
    const fromBin = userName.includes('A') ? "AI-01" : "BIO-01";
    const line = BIN_LINE_CONFIG[fromBin];
    base.setGlobalValue(LINE_INBOUND_CONFIG[line]["inboundOrderIdGlobalValue"], orderId);
    base.setGlobalValue(LINE_INBOUND_CONFIG[line]["askInboundGlobalValue"], true);
    ev["fromBin"] = fromBin;
    ev["status"] = "Commited";
    if (!qty) {
        ev["qty"] = 1;
    }
    return JSON.stringify({ error: false });
}
//实体拦截器：【物料出库】创建前寻找库存并创建单行（出一托）
// function findInvAndBuildLinesBeforeCreating(tc: TraceContext, em: EntityMeta, evList: MapToAny[]) {
//     base.logDebug(tc, `findInvAndBuildLinesAfterCreating evList = ${base.jsonToString(evList)}`)
//     const ev = evList[0]
//     const o = entity.buildFindOptions(null, ["-row"], null, null)
//     const material = ev.btMaterial
//     let found = false
//     let fromBinId = ""
//     let containerId = ""
//     let fromBinChannel = ""
//     base.withLock("出库找库存", () => {
//         const channels = entity.findMany(tc, "FbRackChannel", cq.and([cq.eq("material", material), cq.ne("disabled", true), cq.ne("ioState", "入"),cq.eq("ioReady", true)]), null)
//         base.logInfo(tc,`channels${channels}`)
//     })
//     if (found) {
//         return JSON.stringify({ error: false })
//     }
//     return JSON.stringify({ error: true,errorMsg: `没有可以出的 ${material}` })
// }
//实体拦截器：【物料出库】创建前寻找库存并锁定并且填写 id 至 lockedBy 字段、填写 usedQty
function findInvBeforeOutboundOrderCreating(tc, em, evList) {
    base.logDebug(tc, `findInvAndBuildLinesAfterCreating evList = ${base.jsonToString(evList)}`);
    const ev = evList[0];
    const orderId = ev.id;
    const materialId = ev.btMaterial;
    ev["qty"] = ev["qty"] ? ev["qty"] : 1;
    const qty = ev["qty"];
    let found = false;
    let containerIdsCollects = [];
    let binIdsCollects = [];
    let channelIdsCollects = [];
    let sumQty = 0;
    //库位查找顺序，从外向里
    const bo = entity.buildFindOptions(null, ["-row"], null, null);
    //巷道查找顺序，小最内侧时间优先，短巷道优先，出库状态优先，id 从小到大
    const co = entity.buildFindOptions(["id"], ["firstDate", "-district", "-ioState", "id"], null, null);
    base.withLock("锁资源", () => {
        //先找所有可以出的巷道
        const matchedChannels = entity.findMany(tc, "FbRackChannel", cq.and([cq.ne("ioState", "In"), cq.ne("disabled", true), cq.eq("material", materialId), cq.eq("outReady", true)]), co);
        for (const matchedChannel of matchedChannels) {
            //在可出巷道中找库位并计算库存
            const channelId = matchedChannel.id;
            const bins = entity.findMany(tc, "FbBin", cq.and([cq.eq("channel", channelId), cq.eq("occupied", true), cq.ne("locked", true)]), bo);
            for (const bin of bins) {
                const binId = bin.id;
                const containerId = bin.container;
                const invs = entity.findMany(tc, "FbInvLayout", cq.eq("bin", binId), null);
                for (const inv of invs) {
                    const invQty = inv.qty;
                    // 收集库位 id 和容器 id
                    if (!binIdsCollects.includes(binId)) {
                        binIdsCollects.push(binId);
                        containerIdsCollects.push(containerId);
                    }
                    // 收集巷道 id
                    if (!channelIdsCollects.includes(channelId)) {
                        channelIdsCollects.push(channelId);
                    }
                    sumQty = sumQty + invQty;
                    if (sumQty >= qty) {
                        found = true;
                        break;
                    }
                }
                if (found)
                    break;
            }
            if (found)
                break;
        }
        if (found) {
            //锁相关库位和容器
            entity.updateMany(tc, "FbBin", cq.include("id", binIdsCollects), { "locked": true }, null);
            entity.updateMany(tc, "FbContainer", cq.include("id", containerIdsCollects), { "locked": true }, null);
            //修改相关巷道为出库状态
            entity.updateMany(tc, "FbRackChannel", cq.include("id", channelIdsCollects), { "ioState": "Out" }, null);
            //锁库存,标顺序
            let sort = 0;
            for (const containerIdsCollect of containerIdsCollects) {
                sort = sort + 1;
                entity.updateOne(tc, "FbInvLayout", cq.eq("leafContainer", containerIdsCollect), { "locked": true, "lockedBy": orderId, "sort": sort }, null);
            }
        }
    });
    if (found) {
        return JSON.stringify({ error: false });
    }
    return JSON.stringify({ error: true, errorMsg: `没有可以出的 ${materialId}` });
}
//实体拦截器：【物料出库】创建后寻找创建前锁定的库存（lockedBy）并创建单行
function buildBtLinesAfterOutboundOrderCreating(tc, em, evList) {
    const ev = evList[0];
    const orderId = ev.id;
    const btLines = ev["btLines"];
    const io = entity.buildFindOptions(null, ["sort"], null, null);
    const invs = entity.findMany(tc, "FbInvLayout", cq.and([cq.eq("locked", true), cq.eq("lockedBy", orderId)]), io);
    for (const inv of invs) {
        const binId = inv.bin;
        const containerId = inv.leafContainer;
        const channelId = inv.channel;
        const materialId = inv.btMaterial;
        const qty = inv.qty;
        btLines.push({ bin: binId, container: containerId, btMaterial: materialId, qty: qty, channel: channelId, status: "Init" });
    }
    entity.updateOneById(tc, "OutboundOrder", orderId, { btLines: btLines }, null);
    return JSON.stringify({ error: false });
}
