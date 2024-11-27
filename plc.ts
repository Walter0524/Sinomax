//监控入库位A
function schedulerModbus() {
  base.scheduledAtFixedDelay("CallForEmpty", 200000, counter => {
    soc.updateIntNode("CallForEmpty::start", "呼叫空料架::开始", counter, "None")
    const tc = base.traceContext()
    const A = plc.modbusRead(tc, "PLC", { code: 3, address: 1, qty: 1, slaveId: 1 })[0]
    const B = plc.modbusRead(tc, "PLC", { code: 3, address: 3, qty: 1, slaveId: 1 })[0]
    soc.updateStringNode(`CallForEmpty::SignA`, `呼叫空料架信号`, `PlcA=${A} `, "None")
    soc.updateStringNode(`CallForEmpty::SignB`, `呼叫空料架信号`, `PlcB=${B} `, "None")
    const aa = base.getGlobalValue("aaa")
    const bb = base.getGlobalValue("bbb")
    if (A === 1 && aa !== 1) {
      base.setGlobalValue("aaa", 1)
      const orderId = entity.createOne(tc, "CallForEmpty", { "toBin": "RK-01" }, null)
      const ftId = falcon.runTaskByLabelAsync(tc, "呼叫空料架", { "evId": orderId, "entityName": "CallForEmpty" })
      entity.updateOneById(tc,"CallForEmpty",orderId,{"falconTaskId":ftId},null)
      soc.updateStringNode(`CallForEmpty::Msg::RK-01`, `码垛位A呼叫空托盘`, `呼叫空托盘信号已处理，${orderId}，猎鹰任务 ${ftId}`, "Green")
    }
    if (B === 1 && bb !== 1) {
      base.setGlobalValue("bbb", 1)
      const orderId = entity.createOne(tc, "CallForEmpty", { "toBin": "CR-01" }, null)
      const ftId = falcon.runTaskByLabelAsync(tc, "呼叫空料架", { "evId": orderId, "entityName": "CallForEmpty" })
      entity.updateOneById(tc,"CallForEmpty",orderId,{"falconTaskId":ftId},null)
      soc.updateStringNode(`CallForEmpty::Msg::CR-01`, `码垛位A呼叫空托盘`, `呼叫空托盘信号已处理，${orderId}，猎鹰任务 ${ftId}`, "Green")
    }
    soc.updateIntNode("CallForEmpty::end", "呼叫空料架::结束", counter, "None")
  })
}

