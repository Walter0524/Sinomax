//实体拦截器：【物料入库】创建前根据用户 ID 决定起点库位
function decideFromBinByUserBeforeCreating(tc, em, evList) {
    base.logDebug(tc, `decideFromBinByUserBeforeCreating evList = ${base.jsonToString(evList)}`);
    const ev = evList[0];
    const userId = ev.createdBy;
    base.logDebug(tc, `decideFromBinByUserBeforeCreating,userId = ${userId}`);
    const userName = entity.findOneById(tc, "HumanUser", userId, null).username;
    base.logDebug(tc, `decideFromBinByUserBeforeCreating,userName = ${userName}`);
    const fromBin = userName.includes('A') ? "RK-01" : "CR-01";
    ev["fromBin"] = fromBin;
    return JSON.stringify({ error: false });
}
//实体拦截器：【物料出库】创建前寻找库存并创建单行（出一托）
function findInvAndBuildLinesBeforeCreating(tc, em, evList) {
    base.logDebug(tc, `findInvAndBuildLinesAfterCreating evList = ${base.jsonToString(evList)}`);
    const ev = evList[0];
    const o = entity.buildFindOptions(null, ["-row"], null, null);
    const material = ev.btMaterial;
    let found = false;
    let fromBinId = "";
    let containerId = "";
    let fromBinChannel = "";
    base.withLock("出库找库存", () => {
        const channels = entity.findMany(tc, "FbRackChannel", cq.and([cq.eq("material", material), cq.ne("disabled", true), cq.ne("ioState", "入"), cq.eq("ioReady", true)]), null);
        base.logInfo(tc, `channels${channels}`);
        if (channels && channels.length > 0) {
            // 将 ioDate 转换成时间戳
            channels.forEach(channel => { channel.ioDateTimeStamp = Date.parse(channel.ioDate); });
            // 根据时间戳从小到大排序
            channels.sort((a, b) => a.ioDateTimeStamp - b.ioDateTimeStamp);
            // 提取排序后的 channelIds
            const channelIds = channels.map(channel => channel.id);
            base.logInfo(tc, `channelIds${channelIds}`);
            for (const channelId of channelIds) {
                entity.updateOneById(tc, "FbRackChannel", channelId, { "ioState": "出" }, null);
                const bin = entity.findOne(tc, "FbBin", cq.and([cq.eq("occupied", true), cq.ne("locked", true), cq.eq("channel", channelId)]), o);
                base.logInfo(tc, `bin${bin}`);
                if (bin) {
                    fromBinId = bin.id;
                    containerId = bin.container;
                    fromBinChannel = bin.channel;
                    found = true;
                    //锁容器、起点、库存
                    entity.updateOneById(tc, "FbBin", fromBinId, { "locked": true }, null);
                    entity.updateOneById(tc, "FbContainer", containerId, { "locked": true }, null);
                    const Inv = entity.findOne(tc, "FbInvLayout", cq.eq("leafContainer", containerId), null);
                    entity.updateOneById(tc, "FbInvLayout", Inv.id, { "locked": true }, null);
                    //执行猎鹰任务
                    const falconTaskId = falcon.runTaskByLabelAsync(tc, "物料出库", { "fromBin": fromBinId, "toBin": "CR-01", "container": containerId });
                    //更新巷道出入状态
                    entity.updateOneById(tc, "FbRackChannel", fromBinChannel, { "ioState": "出", "ioFalcon": falconTaskId }, null);
                    //修改单头单行数据
                    // ev["btLines"] = [{ "bin": fromBinId, "container": containerId, "btMaterial": material, "qty": Inv.qty, "falconTaskId": falconTaskId }]
                    ev["qty"] = Inv.qty;
                    break;
                }
            }
        }
    });
    if (found) {
        return JSON.stringify({ error: false });
    }
    return JSON.stringify({ error: true, errorMsg: `没有可以出的 ${material}` });
}
// //实体拦截器：【物料出库】创建后寻找库存并创建单行(出全部)
// function findInvAndBuildLinesAfterCreating(tc: TraceContext, em: EntityMeta, evList: MapToAny[]) {
//     base.logDebug(tc, `findInvAndBuildLinesAfterCreating evList = ${base.jsonToString(evList)}`)
//     const ev = evList[0]
//     const btOrderState = ev.btOrderState
//     const material = ev.btMaterial
//     const orderId = ev.id
//     const entityName = em.getName()
//     let btLines = null
//     let qty = 0
//     if(btOrderState == "Init") return JSON.stringify({ error: false})
//     base.withLock("出库找库存", () => {
//         const channels = entity.findMany(tc, "FbRackChannel", cq.and([cq.eq("material", material), cq.ne("disabled", true), cq.ne("ioState", "出"),cq.ne("ioState", "入"),cq.eq("ioReady",true)]), null)
//         for (const channel of channels){
//             entity.updateOneById(tc, "FbRackChannel",channel.id,{"ioState":"出"},null)
//             const bins = entity.findMany(tc,"FbBin",cq.and([cq.eq("occupied",true)]),null)
//             for(const bin of bins){
//                 //锁起点、锁容器、锁库存
//                 entity.updateOneById(tc,"FbBin",bin.id,{"locked":true},null)
//                 entity.updateOneById(tc,"FbContainer",bin.container,{"locked":true},null)
//                 const Inv = entity.findOne(tc,"FbInvLayout",cq.eq("leafContainer",bin.container),null)
//                 entity.updateOneById(tc,"FbInvLayout",Inv.id,{"locked":true},null)
//                 //执行猎鹰任务
//                 const falconTaskId = falcon.runTaskByLabelAsync(tc,"物料出库",{"fromBin":bin.id,"toBin":"CR-01","container":bin.container})
//                 //获取和更新单头单行
//                 btLines = entity.findOneById(tc,entityName,orderId,null)["btLines"]
//                 btLines.push({"bin":bin.id,"container":bin.container,"btMaterial":material,"qty":Inv.qty,"falconTaskId":falconTaskId})
//                 qty = qty + Inv.qty
//                 entity.updateOneById(tc,entityName,orderId,{"btLines":btLines,"qty":qty},null)
//                 //更新巷道出入状态
//                 entity.updateOneById(tc, "FbRackChannel", bin.channel, { "ioState": "出", "ioFalcon": falconTaskId }, null)
//             }
//         }
//     })
// }
