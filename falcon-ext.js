//定制块：阻塞直到可以放
function waitToPutAway(tc, params) {
    const toBinId = params["toBinId"];
    while (true) {
        const toBin = entity.findOneById(tc, "FbBin", toBinId, null);
        const row = toBin.row;
        const channel = toBin.channel;
        if (row === 1)
            break;
        const preRow = row - 1;
        const PreToBin = entity.findOne(tc, "FbBin", cq.and([cq.eq("channel", channel), cq.eq("row", preRow), cq.eq("occupied", true)]), null);
        if (PreToBin)
            break;
        thread.sleep(1000);
    }
    return base.jsonToString({ "outputParams": { "error": false, "do": true } });
}
//定制块：阻塞直到可以取
function waitToTakeAway(tc, params) {
    const fromBinId = params["fromBinId"];
    while (true) {
        const fromBin = entity.findOneById(tc, "FbBin", fromBinId, null);
        const row = fromBin.row;
        const channel = fromBin.channel;
        const afterRow = row + 1;
        const afterToBin = entity.findOne(tc, "FbBin", cq.and([cq.eq("channel", channel), cq.eq("row", afterRow), cq.eq("occupied", true)]), null);
        if (!afterToBin)
            break;
        thread.sleep(1000);
    }
    return base.jsonToString({ "outputParams": { "error": false, "do": true } });
}
//定制块：入库在巷道找空库位
function findEmptyBinInChannel(tc, params) {
    const materialId = params["materialId"];
    const falconTaskId = params["falconTaskId"];
    let found = false;
    let binId = "";
    let foundChannelId = "";
    //检查物料是否短巷道库区优先，优先入货状态，且如果物料是空料架优先小巷道 id
    let co = entity.buildFindOptions(null, null, null, null);
    const materialShortFirst = entity.findOne(tc, "FbMaterial", cq.and([cq.idEq(materialId), cq.eq("shortFirst", true)]), null);
    if (materialShortFirst) {
        if (materialId == "EmptyShelves") {
            co = entity.buildFindOptions(["id"], ["-district", "ioState", "id"], null, null);
        }
        else {
            co = entity.buildFindOptions(["id"], ["-district", "ioState", "-id"], null, null);
        }
    }
    else {
        if (materialId == "EmptyShelves") {
            co = entity.buildFindOptions(["id"], ["district", "ioState", "id"], null, null);
        }
        else {
            co = entity.buildFindOptions(["id"], ["district", "ioState", "-id"], null, null);
        }
    }
    //库位查找顺序，从里向外
    const bo = entity.buildFindOptions(null, ["row"], null, null);
    base.withLock("锁资源", () => {
        while (true) {
            //优先找物料匹配的；入货状态,优先大巷道 id；找非入状态、未停用、非禁止入库、巷道；如果物料不是空料架，需要再判断巷道是否允许入库；
            let matchedChannels = entity.findMany(tc, "FbRackChannel", cq.and([cq.ne("ioState", "Out"), cq.ne("disabled", true), cq.eq("material", materialId), cq.ne("inStop", true)]), co);
            if (materialId == "EmptyShelves") {
                matchedChannels = entity.findMany(tc, "FbRackChannel", cq.and([cq.ne("ioState", "Out"), cq.ne("disabled", true), cq.eq("material", materialId)]), co);
            }
            if (matchedChannels && matchedChannels.length > 0) {
                for (const matchedChannel of matchedChannels) {
                    const channelId = matchedChannel.id;
                    //从里到外查找匹配巷道的、未锁定、无货库位
                    const bin = entity.findOne(tc, "FbBin", cq.and([cq.eq("channel", channelId), cq.ne("occupied", true), cq.ne("locked", true)]), bo);
                    if (bin) {
                        found = true;
                        binId = bin.id;
                        foundChannelId = channelId;
                        break;
                    }
                }
            }
            //如果没有找到匹配的巷道 || 匹配巷道没有找到空库位，查找其他巷道的第一排（第一排为空，巷道肯定无物料）；如果物料不是空料架，需要再判断巷道是否允许入库；找到后修改巷道物料；
            if (!found) {
                let mismatchedChannels = entity.findMany(tc, "FbRackChannel", cq.and([cq.ne("ioState", "Out"), cq.ne("disabled", true), cq.ne("material", materialId), cq.ne("inStop", true)]), co);
                if (materialId == "EmptyShelves") {
                    mismatchedChannels = entity.findMany(tc, "FbRackChannel", cq.and([cq.ne("ioState", "Out"), cq.ne("disabled", true), cq.ne("material", materialId)]), co);
                }
                if (mismatchedChannels && mismatchedChannels.length > 0) {
                    for (const mismatchedChannel of mismatchedChannels) {
                        const channelId = mismatchedChannel.id;
                        const bin = entity.findOne(tc, "FbBin", cq.and([cq.eq("channel", channelId), cq.ne("occupied", true), cq.ne("locked", true), cq.eq("row", 1)]), bo);
                        if (bin) {
                            found = true;
                            binId = bin.id;
                            foundChannelId = channelId;
                            // 修改巷道物料
                            entity.updateOneById(tc, "FbRackChannel", foundChannelId, { "material": materialId }, null);
                            break;
                        }
                    }
                }
            }
            if (found) {
                //修改巷道 ioState 为出库，并更新巷道猎鹰任务
                entity.updateOneById(tc, "FbRackChannel", foundChannelId, { "ioState": "In", "ioFalcon": falconTaskId }, null);
                //锁定库位
                entity.updateOneById(tc, "FbBin", binId, { "locked": true }, null);
                break;
            }
            thread.sleep(1000);
        }
    });
    return base.jsonToString({ "outputParams": { "error": false, "binId": binId, "foundChannelId": foundChannelId } });
}
//定制块：在空料架巷道找空容器
function findEmptyShelvesInChannel(tc, params) {
    const falconTaskId = params["falconTaskId"];
    let found = false;
    let binId = "";
    let containerId = "";
    let foundChannelId = "";
    const co = entity.buildFindOptions(["id"], ["district", "-ioState", "-id"], null, null);
    const bo = entity.buildFindOptions(null, ["-row"], null, null);
    base.withLock("锁资源", () => {
        while (true) {
            //优先短库区,优先出货状态,优先大巷道 id；找非入状态、未停用、物料为空料架的巷道
            const emptyShelvesChannels = entity.findMany(tc, "FbRackChannel", cq.and([cq.ne("ioState", "In"), cq.ne("disabled", true), cq.eq("material", "EmptyShelves")]), co);
            if (!emptyShelvesChannels || emptyShelvesChannels.length === 0)
                continue;
            for (const emptyShelvesChannel of emptyShelvesChannels) {
                const emptyShelvesChannelId = emptyShelvesChannel.id;
                //优先最外侧的；找未锁定、有货的库位
                const bin = entity.findOne(tc, "FbBin", cq.and([cq.eq("channel", emptyShelvesChannelId), cq.ne("locked", true), cq.eq("occupied", true)]), bo);
                if (bin) {
                    found = true;
                    binId = bin.id;
                    containerId = bin.container;
                    foundChannelId = emptyShelvesChannelId;
                    //修改巷道 ioState 为出库，并更新巷道猎鹰任务
                    entity.updateOneById(tc, "FbRackChannel", emptyShelvesChannelId, { "ioState": "Out", "ioFalcon": falconTaskId }, null);
                    //锁定库位和其上空容器
                    entity.updateOneById(tc, "FbBin", binId, { "locked": true }, null);
                    entity.updateOneById(tc, "FbContainer", containerId, { "locked": true }, null);
                    break;
                }
            }
            if (found)
                break;
            thread.sleep(1000);
        }
    });
    return base.jsonToString({ "outputParams": { "error": false, "binId": binId, "containerId": containerId, "foundChannelId": foundChannelId } });
}
//定制块：根据 binId 获取对应产线 PLC 配置
function getPlcConfigByBinId(tc, params) {
    const binId = params["binId"];
    const line = BIN_LINE_CONFIG[binId];
    const plcName = LINE_PLC_CONFIG[line]["plcName"];
    const slaveId = LINE_PLC_CONFIG[line]["slaveId"];
    const occupiedAddr = LINE_PLC_CONFIG[line]["occupiedAddr"];
    const unoccupied = LINE_PLC_CONFIG[line]["unoccupied"];
    const occupied = LINE_PLC_CONFIG[line]["occupied"];
    const callbackAddr = LINE_PLC_CONFIG[line]["callbackAddr"];
    const callbackDone = LINE_PLC_CONFIG[line]["callbackDone"];
    const callbackReset = LINE_PLC_CONFIG[line]["callbackReset"];
    const askEmptyShelvesAddr = LINE_PLC_CONFIG[line]["askEmptyShelvesAddr"];
    const askEmptyShelves = LINE_PLC_CONFIG[line]["askEmptyShelves"];
    let askEmptyShelvesBack = null;
    if (line == "B")
        askEmptyShelvesBack = LINE_PLC_CONFIG[line]["askEmptyShelvesBack"];
    return base.jsonToString({ "outputParams": { "error": false, "line": line, "plcName": plcName, "slaveId": slaveId, "occupiedAddr": occupiedAddr, "unoccupied": unoccupied, "occupied": occupied, "callbackAddr": callbackAddr, "callbackDone": callbackDone, "callbackReset": callbackReset, "askEmptyShelvesAddr": askEmptyShelvesAddr, "askEmptyShelves": askEmptyShelves, "askEmptyShelvesBack": askEmptyShelvesBack } });
}
//定制块：读 PLC 直到 产线关闭（false） || 产线出于出库状态（fales） || 产线叫空托（true），并返回 doAddEmptyShelves:boolean
function inboundBlockOne(tc, params) {
    const binId = params["binId"];
    const line = BIN_LINE_CONFIG[binId];
    const plcName = LINE_PLC_CONFIG[line]["plcName"];
    const slaveId = LINE_PLC_CONFIG[line]["slaveId"];
    const statusAddr = LINE_PLC_CONFIG[line]["statusAddr"];
    const occupiedAddr = LINE_PLC_CONFIG[line]["occupiedAddr"];
    let doAddEmptyShelves = false;
    while (true) {
        const status = plc.modbusRead(tc, plcName, { address: statusAddr, qty: 1, code: 0x03, slaveId: slaveId })[0];
        if (status == LINE_PLC_CONFIG[line]["stoped"]) {
            break;
        }
        if (line == "B") {
            if (status == LINE_PLC_CONFIG[line]["outbound"]) {
                break;
            }
        }
        const occupied = plc.modbusRead(tc, plcName, { address: occupiedAddr, qty: 1, code: 0x03, slaveId: slaveId })[0];
        if (occupied != LINE_PLC_CONFIG[line]["unoccupied"])
            continue;
        const askEmptyShelves = plc.modbusRead(tc, plcName, { address: LINE_PLC_CONFIG[line]["askEmptyShelvesAddr"], qty: 1, code: 0x03, slaveId: slaveId })[0];
        if (askEmptyShelves == LINE_PLC_CONFIG[line]["askEmptyShelves"]) {
            doAddEmptyShelves = true;
            break;
        }
        thread.sleep(500);
    }
    return base.jsonToString({ "outputParams": { "error": false, "doAddEmptyShelves": doAddEmptyShelves } });
}
//定制块：（读 PLC 直到 产线关闭（false） || 如果是 B 产线出于出库状态（fales）） || 读直到入库全局变量 aAskInbound 、bAskInbound 直到为 true（true），并返回 doTakeAwayMaterial:boolean、inboundOrderId:string
function inboundBlockTwo(tc, params) {
    const binId = params["binId"];
    const line = BIN_LINE_CONFIG[binId];
    const plcName = LINE_PLC_CONFIG[line]["plcName"];
    const slaveId = LINE_PLC_CONFIG[line]["slaveId"];
    const statusAddr = LINE_PLC_CONFIG[line]["statusAddr"];
    const occupiedAddr = LINE_PLC_CONFIG[line]["occupiedAddr"];
    let doTakeAwayMaterial = false;
    let inboundOrderId = "";
    let inboundMaterialId = "";
    while (true) {
        const status = plc.modbusRead(tc, plcName, { address: statusAddr, qty: 1, code: 0x03, slaveId: slaveId })[0];
        if (status == LINE_PLC_CONFIG[line]["stoped"]) {
            break;
        }
        if (line == "B") {
            if (status == LINE_PLC_CONFIG[line]["outbound"]) {
                break;
            }
        }
        const occupied = plc.modbusRead(tc, plcName, { address: occupiedAddr, qty: 1, code: 0x03, slaveId: slaveId })[0];
        if (occupied != LINE_PLC_CONFIG[line]["occupied"])
            continue;
        const askInbound = base.getGlobalValue(LINE_INBOUND_CONFIG[line]["askInboundGlobalValue"]);
        if (askInbound == true) {
            doTakeAwayMaterial = true;
            inboundOrderId = base.getGlobalValue(LINE_INBOUND_CONFIG[line]["inboundOrderIdGlobalValue"]);
            thread.sleep(500);
            inboundMaterialId = entity.findOneById(tc, "InboundOrder", inboundOrderId, null)["btMaterial"];
            base.setGlobalValue(LINE_INBOUND_CONFIG[line]["askInboundGlobalValue"], false);
            base.setGlobalValue(LINE_INBOUND_CONFIG[line]["inboundOrderIdGlobalValue"], "");
            break;
        }
        thread.sleep(500);
    }
    return base.jsonToString({ "outputParams": { "error": false, "doTakeAwayMaterial": doTakeAwayMaterial, "inboundOrderId": inboundOrderId, "inboundMaterialId": inboundMaterialId } });
}
//定制块：猎鹰占用巷道
function falconOccupiedChannel(tc, params) {
    const ioState = params["flow"];
    const ioFalcon = params["falconTaskId"];
    const binId = params["binId"];
    const bin = entity.findOneById(tc, "FbBin", binId, null);
    const channelId = bin.channel;
    entity.updateOneById(tc, "FbRackChannel", channelId, { "ioState": ioState, "ioFalcon": ioFalcon }, null);
    return base.jsonToString({ "outputParams": { "error": false } });
}
//定制块：尝试重置库位所在巷道状态
function tryToResetChannelIoStateAndIoFalcon(tc, params) {
    const Outbound = params["Outbound"];
    // const emptyShelves = params["emptyShelves"] as boolean
    const falconTaskId = params["falconTaskId"];
    const binId = params["binId"];
    const bin = entity.findOneById(tc, "FbBin", binId, null);
    const channelId = bin.channel;
    const channel = entity.findOne(tc, "FbRackChannel", cq.and([cq.idEq(channelId), cq.eq("ioFalcon", falconTaskId)]), null);
    if (!channel)
        return base.jsonToString({ "outputParams": { "error": false, "reseted": false } });
    const row = bin.row;
    const innerBin = entity.findOne(tc, "FbBin", cq.and([cq.eq("channel", channelId), cq.eq("row", row - 1)]), null);
    // 如果是入库或者出库时存在更内侧的库位只处理 ioState、ioFalcon
    if (!Outbound || innerBin) {
        entity.updateOneById(tc, "FbRackChannel", channelId, { "ioState": null, "ioFalcon": null }, null);
        return base.jsonToString({ "outputParams": { "error": false, "reseted": true } });
    }
    //出库的情况且不存在更内侧的库位，清空 ioState、ioFalcon、material、outReady、inStop、lastDate、firstDate
    entity.updateOneById(tc, "FbRackChannel", channelId, { "ioState": null, "ioFalcon": null, "material": null, "outReady": null, "inStop": null, "lastDate": null, "firstDate": null }, null);
    return base.jsonToString({ "outputParams": { "error": false, "reseted": true } });
}
//定制块：物料入库根据库位 ID 更新对应巷道最内侧和最外侧时间
function updateChannelFirstAndLastDateAfterIn(tc, params) {
    const binId = params["binId"];
    const bin = entity.findOneById(tc, "FbBin", binId, null);
    const channelId = bin.channel;
    const row = bin.row;
    const nowDate = formatTimeStamp(new Date().getTime());
    let firstBin = false;
    entity.updateOneById(tc, "FbRackChannel", channelId, { "lastDate": nowDate }, null);
    if (row == 1) {
        //最内侧，需要额外更新最内侧时间
        firstBin = true;
        entity.updateOneById(tc, "FbRackChannel", channelId, { "firstDate": nowDate }, null);
    }
    return base.jsonToString({ "outputParams": { "error": false, "firstBin": firstBin } });
}
//定制块：根据容器移动库存所在巷道
function changeInvChannelByContainerId(tc, params) {
    const containerId = params["containerId"];
    const binId = params["binId"];
    let updateJson = { "channel": null };
    if (binId) {
        const channelId = entity.findOneById(tc, "FbBin", binId, null)["channel"];
        updateJson = { "channel": channelId };
    }
    entity.updateMany(tc, "FbInvLayout", cq.eq("leafContainer", containerId), updateJson, null);
    return base.jsonToString({ "outputParams": { "error": false } });
}
//定制块：追加容器搬运单途径点
function addCTORouteBinIdsOrRemark(tc, params) {
    const cTOId = params["containerTransportOrderId"];
    const binId = params["binId"];
    const remark = params["remark"];
    if (remark) {
        entity.updateOneById(tc, "ContainerTransportOrder", cTOId, { "remark": remark }, null);
    }
    if (binId) {
        const cTO = entity.findOneById(tc, "ContainerTransportOrder", cTOId, null);
        const routeBinIds = cTO["routeBinIds"];
        routeBinIds.push(binId);
        entity.updateOneById(tc, "ContainerTransportOrder", cTOId, { "routeBinIds": routeBinIds }, null);
    }
    return base.jsonToString({ "outputParams": { "error": false } });
}
//定制块：根据库位 id 匹配产线
function getLineByBinId(tc, params) {
    const binId = params["binId"];
    const line = BIN_LINE_CONFIG["binId"];
    return base.jsonToString({ "outputParams": { "error": false, "line": line } });
}
//定制块：根据产线匹配产线相关库位
function getLineTempByLine(tc, params) {
    const line = params["line"];
    const tempBinId = LINE_TEMP_CONFIG[line]["tempBin"];
    const lineBinId = LINE_TEMP_CONFIG[line]["lineBin"];
    return base.jsonToString({ "outputParams": { "error": false, "tempBinId": tempBinId, "lineBinId": lineBinId } });
}
//定制块：根据单头 id 和单行行号更新单行状态字段
function updateLineStatus(tc, params) {
    const orderLinesName = params["orderLinesName"];
    const btParentId = params["btParentId"];
    const btLineNo = params["btLineNo"];
    const status = params["status"];
    entity.updateOne(tc, orderLinesName, cq.and([cq.eq("btParentId", btParentId), cq.eq("btLineNo", btLineNo)]), { "status": status }, null);
    return base.jsonToString({ "outputParams": { "error": false } });
}
//定制块：读直到 C 出库口全局变量允许空料架回库并恢复全局变量初始化
function waitToCAskEmptyShelvesBack(tc, params) {
    while (true) {
        const cAskEmptyShelvesBack = base.getGlobalValue(MANUALLINE_CONFIG["askEmptyShelvesBackGlobalValue"]);
        if (cAskEmptyShelvesBack) {
            base.setGlobalValue(MANUALLINE_CONFIG["askEmptyShelvesBackGlobalValue"], false);
            break;
        }
        thread.sleep(500);
    }
}
