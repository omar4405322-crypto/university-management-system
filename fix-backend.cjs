const fs = require('fs');
const path = require('path');
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if(file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.mjs')) results.push(file);
        }
    });
    return results;
}
const files = walk('artifacts/api-server');
files.forEach(f => {
    let c = fs.readFileSync(f, 'utf8');
    if(c.includes('sessionType') || c.includes('SessionType')) {
        console.log('Fixed', f);
        c = c.replace(/sessionType/g, 'slotType').replace(/SessionType/g, 'SlotType');
        fs.writeFileSync(f, c);
    }
});
