//定制块：恢复全局变量
function restoreGlobalValue(tc: TraceContext, params: MapToAny) {
    const toBin = params["toBin"]
    const gVName = toBin == "RK-01" ? "aaa" : "bbb"
    base.setGlobalValue(gVName, 0)
    return base.jsonToString({ "outputParams": { "error": false, "msg": `全局变量 ${gVName} 复位 0` } })
}

//定制块：按巷道找空库位
function findEmptyBinByChannel(tc: TraceContext, params: MapToAny) {
    const material = params["btMaterial"]
    const falconTaskId = params["falconTaskId"]
    const o = entity.buildFindOptions(null, ["row"], null, null)
    const co = entity.buildFindOptions(null, ["id"], null, null)
    let binId = ""
    //资源锁，防止重复锁定
    base.withLock("入库找空库位", () => {
        // 循环查找
        while (true) {
            // 先按 id 顺序找相同物料的巷道集合
            const channels = entity.findMany(tc, "FbRackChannel", cq.and([cq.eq("material", material), cq.ne("disabled", true), cq.ne("ioState", "出")]), co)
            if (channels && channels.length > 0) {
                // 找到了相同物料的巷道集合，再按巷道 id 顺序找空库位
                const channelIds = channels.map(channel => channel.id)
                const bin = entity.findOne(tc, "FbBin", cq.and([cq.ne("occupied", true), cq.ne("disabled", true), cq.ne("locked", true), cq.include("channel", channelIds)]), o)
                if (bin) {
                    // 找到了空库位，更新巷道出入状态为 "入" 和对应出入猎鹰任务
                    binId = bin.id
                    const channelId = bin.channel
                    entity.updateOneById(tc, "FbRackChannel", channelId, { "ioState": "入", "material": material, "ioFalcon": falconTaskId }, null)
                    break
                } else {
                    // 找不到空库位，再找其他巷道第一排库位
                    const channels = entity.findMany(tc, "FbRackChannel", cq.and([cq.ne("disabled", true), cq.ne("ioState", "出")]), co)
                    const channelIds = channels.map(channel => channel.id)
                    const bin = entity.findOne(tc, "FbBin", cq.and([cq.ne("occupied", true), cq.ne("disabled", true), cq.ne("locked", true), cq.eq("row", 1), cq.include("channel", channelIds)]), o)
                    if (bin) {
                        // 找到了空库位，更新巷道物料、出入状态为 "入" 、对应出入猎鹰任务
                        binId = bin.id
                        const channelId = bin.channel
                        entity.updateOneById(tc, "FbRackChannel", channelId, { "ioState": "入", "material": material, "ioFalcon": falconTaskId }, null)
                        break
                    }
                }
            } else {
                // 找不到相同物料的巷道集合，再找其他巷道第一排库位
                const channels = entity.findMany(tc, "FbRackChannel", cq.and([cq.ne("disabled", true), cq.ne("ioState", "出")]), co)
                const channelIds = channels.map(channel => channel.id)
                const bin = entity.findOne(tc, "FbBin", cq.and([cq.ne("occupied", true), cq.ne("disabled", true), cq.ne("locked", true), cq.eq("row", 1), cq.include("channel", channelIds)]), o)
                if (bin) {
                    // 找到了空库位，更新巷道物料、出入状态为 "入" 、对应出入猎鹰任务
                    binId = bin.id
                    const channelId = bin.channel
                    entity.updateOneById(tc, "FbRackChannel", channelId, { "ioState": "入", "material": material, "ioFalcon": falconTaskId }, null)
                    break
                }
            }
            thread.sleep(1000)
        }
        // 锁定前面找到的库位
        entity.updateOneById(tc, "FbBin", binId, { "locked": true }, null)
    })
    return base.jsonToString({ "outputParams": { "error": false, "found": true, "binId": binId } })
}

//定制块：阻塞直到可以放
function waitToPutAway(tc: TraceContext, params: MapToAny) {
    const toBinId = params["toBinId"]
    while (true) {
        const toBin = entity.findOneById(tc, "FbBin", toBinId, null)
        const row = toBin.row
        const channel = toBin.channel
        if (row === 1) break
        const preRow = row - 1
        const PreToBin = entity.findOne(tc, "FbBin", cq.and([cq.eq("channel", channel), cq.eq("row", preRow), cq.eq("occupied", true)]), null)
        if (PreToBin) break
        thread.sleep(1000)
    }
    return base.jsonToString({ "outputParams": { "error": false, "do": true } })
}

//定制块：阻塞直到可以取
function waitToTakeAway(tc: TraceContext, params: MapToAny) {
    const fromBinId = params["fromBin"]
    while (true) {
        const fromBin = entity.findOneById(tc, "FbBin", fromBinId, null)
        const row = fromBin.row
        const channel = fromBin.channel
        const afterRow = row + 1
        const afterToBin = entity.findOne(tc, "FbBin", cq.and([cq.eq("channel", channel), cq.eq("row", afterRow), cq.eq("occupied", true)]), null)
        if (!afterToBin) break
        thread.sleep(1000)
    }
    return base.jsonToString({ "outputParams": { "error": false, "do": true } })
}

//定制块：尝试重置巷道出入状态
function tryToResetChannelIoState(tc: TraceContext, params: MapToAny) {
    const falconTaskId = params["falconTaskId"]
    const channelId = params["channelId"]
    const channel = entity.findOne(tc, "FbRackChannel", cq.and([cq.idEq(channelId), cq.eq("ioFalcon", falconTaskId)]), null)
    if (channel) {
        entity.updateOneById(tc, "FbRackChannel", channelId, { "ioState": null, "ioFalcon": null }, null)
        return base.jsonToString({ "outputParams": { "error": false, "reset": true } })
    }
    return base.jsonToString({ "outputParams": { "error": false, "reset": false } })
}

//定制块：尝试清除巷道物料信息
function tryToResetChannelMaterial(tc: TraceContext, params: MapToAny) {
    const channelId = params["channelId"]
    const fromBinId = params["fromBinId"]
    const fromBin = entity.findOne(tc, "FbBin", cq.and([cq.idEq(fromBinId), cq.eq("row", 1)]), null)
    if (fromBin) {
        entity.updateOneById(tc, "FbRackChannel", channelId, { "material": null }, null)
        return base.jsonToString({ "outputParams": { "error": false, "reset": true } })
    }
    return base.jsonToString({ "outputParams": { "error": false, "reset": false } })
}

//定制块：根据库区找空料架（逻辑上优先出不同巷道，提高上空托速度，因为入库口仅 2 处，应当不影响物料上架库位的腾空）
function findEmptyContainerByDistrict(tc: TraceContext, params: MapToAny) {
    const districtId = params["districtId"]
    const falconTaskId = params["falconTaskId"]
    const o = entity.buildFindOptions(null, ["-row"], null, null)
    const co = entity.buildFindOptions(null, ["id"], null, null)
    let binId = ""
    let containerId = ""
    let channelId = ""
    let doWhile = true
    // 资源锁防止重复锁定
    base.withLock("出库找空容器", () => {
        while (doWhile) {
            //先找无任务的空料架巷道集合
            const channels = entity.findMany(tc, "FbRackChannel", cq.and([cq.ne("disabled", true), cq.ne("ioState", "出"), cq.ne("ioState", "入"), cq.eq("material", "EMPTY")]), co)
            if (channels && channels.length > 0) {
                //找到了无任务的空料架巷道集合
                for (const channel of channels) {
                    //遍历无任务的空料架巷道集合
                    channelId = channel.id
                    //找这个巷道的无锁有货库位
                    const bin = entity.findOne(tc, "FbBin", cq.and([cq.eq("channel", channelId), cq.eq("occupied", true), cq.ne("locked", true)]), o)
                    if (bin) {
                        //找到了库位
                        binId = bin.id
                        containerId = bin.container
                        doWhile = false
                        break
                    } else {
                        //没找到，改为查找有出库任务的空料架巷道集合
                        const channels = entity.findMany(tc, "FbRackChannel", cq.and([cq.ne("disabled", true), cq.eq("ioState", "出"), cq.eq("material", "EMPTY"), cq.eq("district", districtId)]), co)
                        if (channels && channels.length > 0) {
                            //找打了有出库任务的空料架巷道集合
                            for (const channel of channels) {
                                //遍历有出库任务的空料架巷道集合
                                channelId = channel.id

                                //找这个巷道的无锁有货库位
                                const bin = entity.findOne(tc, "FbBin", cq.and([cq.eq("channel", channelId), cq.eq("occupied", true), cq.ne("locked", true)]), o)
                                if (bin) {
                                    //找到了库位
                                    entity.updateOneById(tc, "FbRackChannel", channelId, { "ioState": "出", "ioFalcon": falconTaskId }, null)
                                    binId = bin.id
                                    containerId = bin.container
                                    doWhile = false
                                    break
                                }
                            }
                        }
                    }
                }
            } else {
                //找不到，改为查找有出库任务的空料架巷道
                const channels = entity.findMany(tc, "FbRackChannel", cq.and([cq.ne("disabled", true), cq.eq("ioState", "出"), cq.eq("material", "EMPTY"), cq.eq("district", districtId)]), co)
                if (channels && channels.length > 0) {
                    //找打了有出库任务的空料架巷道集合
                    for (const channel of channels) {
                        //遍历有出库任务的空料架巷道集合
                        channelId = channel.id
                        //找这个巷道的无锁有货库位
                        const bin = entity.findOne(tc, "FbBin", cq.and([cq.eq("channel", channelId), cq.eq("occupied", true), cq.ne("locked", true)]), o)
                        if (bin) {
                            //找到了库位
                            binId = bin.id
                            containerId = bin.container
                            doWhile = false
                            break
                        }
                    }
                }
            }
            thread.sleep(2000)
        }
        // 锁定找到的库位和容器,更新巷道出入库状态 "出"、对应出入库猎鹰任务
        entity.updateOneById(tc, "FbRackChannel", channelId, { "ioState": "出", "ioFalcon": falconTaskId }, null)
        entity.updateOneById(tc, "FbBin", binId, { "locked": true }, null)
        entity.updateOneById(tc, "FbContainer", containerId, { "locked": true }, null)
    })
    return base.jsonToString({ "outputParams": { "error": false, "found": true, "binId": binId, "containerId": containerId } })
}