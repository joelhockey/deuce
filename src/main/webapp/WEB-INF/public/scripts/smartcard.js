function apdu(termName) {
    var scard = document.getElementById('SmartcardApplet');
    var term = scard.terminals().getTerminal(termName);
    var sc = scard.getSmartcard(term);
    
    // get cplc, iin, cin
    var cplc = sc.transmith('00ca9f7f00');
    var csn = cplc && cplc.substring(16, 32);
    var iin = sc.transmith('00ca004200');
    var cin = sc.transmith('00ca004500');

    var data = {csn: csn, iin: iin, cin: cin, terminal: termName};
    
    $.getJSON('/apdu', data, function(msg) {
        if (msg.msgtype !== "actions") {
            done = true;
            return;
        }
        var actions = msg.actions;
        var results = [];
        for (var i = 0; i < actions.length; i++) {
            var action = actions[i];
            var result = { id: action.id, name: action.name, apdus: [] };
            results.push(result);
            for (var j = 0; j < action.apdus.length; j++) {
                alert('apdu > ' + action.id + ':' + action.name + ':' + action.apdus[i]);
                var apdures = sc.transmith(action.apdus[i]);
                alert('apdu < ' + apdures);
                result.apdus.push(apdures);
            }
        }
        data.msgtype = "results";
        data.results = results;
        delete data.actions;
    });
    alert('done');
}