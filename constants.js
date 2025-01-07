const LINE_PLC_CONFIG = {
    "A": {
        "plcName": "PLC1", "slaveId": 1,
        "statusAddr": 5, "stoped": 0, "inbound": 1,
        "askEmptyShelvesAddr": 1, "askEmptyShelves": 1,
        "occupiedAddr": 2, "unoccupied": 0, "occupied": 1,
        "callbackAddr": 41, "callbackDone": 2, "callbackReset": 0
    },
    "B": {
        "plcName": "PLC1", "slaveId": 1,
        "statusAddr": 6, "stoped": 0, "inbound": 1, "outbound": 2,
        "askEmptyShelvesAddr": 3, "askEmptyShelves": 1, "askEmptyShelvesBack": 2,
        "occupiedAddr": 4, "unoccupied": 0, "occupied": 1,
        "callbackAddr": 42, "callbackDone": 2, "callbackReset": 0
    }
};
const LINE_INBOUND_CONFIG = {
    "A": {
        "askInboundGlobalValue": "aAskInbound",
        "inboundOrderIdGlobalValue": "aInboundOrderId"
    },
    "B": {
        "askInboundGlobalValue": "bAskInbound",
        "inboundOrderIdGlobalValue": "bInboundOrderId"
    }
};
const BIN_LINE_CONFIG = {
    "AI-01": "A",
    "ATP-01": "A",
    "BIO-01": "B",
    "BTP-01": "B"
};
const LINE_TEMP_CONFIG = {
    "A": {
        "tempBin": "ATP-01",
        "lineBin": "AI-01"
    },
    "B": {
        "tempBin": "BTP-01",
        "lineBin": "BIO-01"
    }
};
const MANUALLINE_CONFIG = {
    "askEmptyShelvesBackGlobalValue": "cAskEmptyShelvesBack"
};
