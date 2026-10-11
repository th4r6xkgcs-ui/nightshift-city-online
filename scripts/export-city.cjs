// Machine-readable client catalog. No server or protocol files are imported.
const {layout}=require('../city-data.js');
process.stdout.write(JSON.stringify(layout(),null,2)+'\n');
