function apdu(termName) {
    var scard = document.getElementById('SmartcardApplet');
    var term = scard.terminals().getTerminal(termName);
    var sc = scard.getSmartcard(term);
    
    // get cplc, iin, cin
    var cplc = sc.transmith('80ca9f7f00');
    var iin = sc.transmith('80ca004200');
    var cin = sc.transmith('80ca004500');

    var data = {cplc: cplc, iin: iin, cin: cin, terminal: termName};
    
    while (true) {
        $.getJSON('/apdu', data, function(apdus) {
            if (!apdus || apdus.length == 0) {
                break;
            }
            data = [];
            for (int i = 0; i < apdus.length; i++) {
                alert('apdu > ' + apdus[i].id + ':' + apdus[i].apdu);
                var apdures = sc.transmith(apdus[i].apdu);
                alert('apdu < ' + apdures);
                result.push({id: apdus[i].id, apdures: apdures});
            }
        })
    }
    alert('done');
}