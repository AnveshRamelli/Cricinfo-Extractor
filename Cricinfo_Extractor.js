// node Cricinfo_Extractor.js --dataFolder=data --excel=WorldCup.csv --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results
// npm install minimist
// npm install axios
// npm install jsdom
// npm install pdf-lib
// npm install excel4node

let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let pdf = require("pdf-lib");
let excel = require("excel4node");
let fs = require("fs");
let path = require("path");

let args = minimist(process.argv);

// Download data using axios

let ResponsePromise = axios.get(args.source);
ResponsePromise.then(function(response){
    let html = response.data;

// Read data using jsdom
    
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;

    let matches = [];
    let matchdivs = document.querySelectorAll('div.match-score-block');

    for (let i = 0;i < matchdivs.length; i++) {
        let match = {
            t1 : "",
            t2 : "",
            t1s : "",
            t2s : "",
            result : ""
        };

        let teams = matchdivs[i].querySelectorAll("div.name-detail > p.name");
        match.t1 = teams[0].textContent;
        match.t2 = teams[1].textContent;

        let scores = matchdivs[i].querySelectorAll("div.score-detail > span.score");
        if (scores.length == 2) {
            match.t1s = scores[0].textContent;
            match.t2s = scores[1].textContent;
        }
        else if (scores.length == 1) {
            match.t1s = scores[0].textContent;
        }

        let result = matchdivs[i].querySelector("div.status-text > span");
        match.result = result.textContent;

        matches.push(match);
    }
    let matchesJSON = JSON.stringify(matches);
    fs.writeFileSync("matches.json", matchesJSON, "utf-8");

    let teams = [];
    for (let i = 0; i < matches.length; i++) {
        putTeamInTeamsArrayIfMissing(teams, matches[i]);
    }

    for (let i = 0; i < matches.length; i++) {
        putMatchesInAppropriateTeams(teams, matches[i]);
    }

    let teamsJSON = JSON.stringify(teams);
    fs.writeFileSync("teams.json", teamsJSON, "utf-8");

    createExcelFile(teams);
    createFolders(teams, args.dataFolder);

}).catch(function(err){
    console.log(err);
})

function putTeamInTeamsArrayIfMissing(teams, match) {
    let t1idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t1) {
            t1idx = i;
            break;
        }
    }
    if (t1idx == -1) {
        teams.push({
            name: match.t1,
            matches: []
        });
    }

    let t2idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t2) {
            t2idx = i;
            break;
        }
    }
    if (t2idx == -1) {
        teams.push({
            name: match.t2,
            matches: []
        });
    }
}

function putMatchesInAppropriateTeams(teams, match) {
    let t1idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t1) {
            t1idx = i;
            break;
        }
    }
    let team1 = teams[t1idx];
    team1.matches.push({
        vs: match.t2,
        selfScore: match.t1s,
        opponentScore: match.t2s,
        result: match.result
    });

    let t2idx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == match.t2) {
            t2idx = i;
            break;
        }
    }

    let team2 = teams[t2idx];
    team2.matches.push({
        vs: match.t1,
        selfScore: match.t2s,
        opponentScore: match.t1s,
        result: match.result
    });
}

// Wrte data to excel using excel4node

function createExcelFile(teams) {
    let wb = new excel.Workbook();

    for (let i = 0; i < teams.length; i++) {
        let sheet = wb.addWorksheet(teams[i].name);
        sheet.cell(1,1).string("vs");
        sheet.cell(1,2).string("Self Score");
        sheet.cell(1,3).string("Opponent Score");
        sheet.cell(1,4).string("result");
        
        for (let j = 0; j < teams[i].matches.length; j++) {
            sheet.cell(j + 2, 1).string(teams[i].matches[j].vs);
            sheet.cell(j + 2, 2).string(teams[i].matches[j].selfScore);
            sheet.cell(j + 2, 3).string(teams[i].matches[j].opponentScore);
            sheet.cell(j + 2, 4).string(teams[i].matches[j].result);
        }
    }
    wb.write(args.excel);
}


// Write data to pdf using pdf-lib

function createFolders(teams, dataDir) {
    if(fs.existsSync(dataDir)) {
        fs.rmdirSync(dataDir, { recursive: true});
    }
    fs.mkdirSync(dataDir);

    for (let i = 0; i < teams.length; i++) {
        let teamFN = path.join(args.dataFolder, teams[i].name);
        fs.mkdirSync(teamFN);

        for (let j = 0; j < teams[i].matches.length; j++) {
            let matchFN = path.join(teamFN, teams[i].matches[j].vs);
            createScorecard(teams[i].name, teams[i].matches[j], matchFN);
        }
    }
}


function createScorecard(teamName, match, matchFN) {
    let t1 = teamName;
    let t2 = match.vs;
    let t1s = match.selfScore;
    let t2s = match.opponentScore;
    let result = match.result;

    let pdfTemplateBytes = fs.readFileSync("Template.pdf");
    let pdfdocPromise = pdf.PDFDocument.load(pdfTemplateBytes);
    pdfdocPromise.then(function(pdfdoc){
        let page = pdfdoc.getPage(0);

        page.drawText(t1, {
            x: 315,
            y: 550,
            size: 20
        });

        page.drawText(t2, {
            x: 315,
            y: 520,
            size: 20
        });

        page.drawText(t1s, {
            x: 315,
            y: 490,
            size: 20
        });

        page.drawText(t2s, {
            x: 315,
            y: 460,
            size: 20
        });

        page.drawText(result, {
            x: 315,
            y: 430,
            size: 14
        });

        let finalPDFBytesPromise = pdfdoc.save();
        finalPDFBytesPromise.then(function(finalPDFBytes){
            if (fs.existsSync(matchFN + ".pdf")){
                fs.writeFileSync(matchFN + "1.pdf", finalPDFBytes);
            }
            else {
                fs.writeFileSync(matchFN + ".pdf", finalPDFBytes);
            }
        }) 
    })
}