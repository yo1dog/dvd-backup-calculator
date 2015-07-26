var fs = require('fs');

var BYTES_IN_KB = 1024;
var BYTES_IN_MB = 1024 * BYTES_IN_KB;
var BYTES_IN_GB = 1024 * BYTES_IN_MB;

var SORT =
'size';
//'numDVDs';
//'name';

var SIZE_DISPLAY =
'auto';
//'original';
//'gbs';
//'mbs';
//'kbs';
//'bytes';

var BYTES_IN_UNITS = {
  kb: BYTES_IN_KB,
  mb: BYTES_IN_MB,
  gb: BYTES_IN_GB
};

var BYTES_IN_DVD    = 4.7 * BYTES_IN_GB;
var BYTES_IN_DL_DVD = 8.5 * BYTES_IN_GB;


function numBytesToSizeString(numBytes) {
  if (SIZE_DISPLAY === 'gbs' || (SIZE_DISPLAY === 'auto' && numBytes > BYTES_IN_GB)) {
    return (numBytes / BYTES_IN_GB).toFixed(2) + ' GB';
  }
  if (SIZE_DISPLAY === 'mbs' || (SIZE_DISPLAY === 'auto' && numBytes > BYTES_IN_MB)) {
    return (numBytes / BYTES_IN_MB).toFixed(2) + ' MB';
  }
  if (SIZE_DISPLAY === 'kbs' || (SIZE_DISPLAY === 'auto' && numBytes > BYTES_IN_KB)) {
    return (numBytes / BYTES_IN_KB).toFixed(2) + ' KB';
  }
  
  return numBytes + 'Bytes';
}

function readGameList(gameListFilepath, cb) {
  fs.readFile(gameListFilepath, function(err, gameListStr) {
    if (err) {
      return cb(err);
    }
    
    var regex = /^(?!#)\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(([\d\.]+)([kmg]b))\s*$/gmi;
    
    var games = [];
    var results;
    while((results = regex.exec(gameListStr))) {
      var title       = results[1];
      var platform    = results[2];
      var origSizeStr = results[3];
      var size        = parseFloat(results[4]);
      var sizeUnit    = results[5].toLowerCase();
      
      var bytesInUnit = BYTES_IN_UNITS[sizeUnit];
      var sizeBytes = Math.ceil(size * bytesInUnit);
      var sizeStr   = numBytesToSizeString(sizeBytes);
      
      var numDVDs = Math.ceil(sizeBytes / BYTES_IN_DVD);
      
      games.push({
        title      : title,
        platform   : platform,
        origSizeStr: origSizeStr,
        sizeBytes  : sizeBytes,
        sizeStr    : sizeStr,
        numDVDs    : numDVDs
      });
    }
    
    switch(SORT) {
      case 'size':
        games.sort(function(a, b) {
          return b.sizeBytes - a.sizeBytes;
        });
        break;
      
      case 'numDVDs':
        games.sort(function(a, b) {
          var c = b.numDVDs - a.numDVDs;
          if (c === 0) {
              c = a.title.localeCompare(b.title);
          }
          
          return c;
        });
        break;
      
      default:
        games.sort(function(a, b) {
          return a.title.localeCompare(b.title);
        });
        break;
    }
    
    return cb(null, games);
  });
}

function calculateStats(games) {
  var totalSizeBytes = 0;
  var totalNumDVDs = 0;
  
  // number of games that require a certain number of DVDs. Ex:
  // {
  //   numDVDsPerGame: 1,
  //   games: [...]
  // },
  // {
  //   numDVDsPerGame: 2,
  //   numGames: [...]
  // },
  // {
  //   numDVDsPerGame: 3,
  //   numGames: [...]
  // }
  var gamesByNumDVDs = [];
  
  for (var i = 0; i < games.length; ++i) {
    totalSizeBytes += games[i].sizeBytes;
    totalNumDVDs += games[i].numDVDs;
    
    // add this game ot the list of games with $games[i].numDVDs DVDs
    var index = -1;
    for (var j = 0; j < gamesByNumDVDs.length; ++j) {
      if (gamesByNumDVDs[j].numDVDsPerGame === games[i].numDVDs) {
        index = j;
        break;
      }
    }
    
    if (index === -1) {
      gamesByNumDVDs.push({
        numDVDsPerGame: games[i].numDVDs,
        games         : [games[i]]
      });
    }
    else {
      gamesByNumDVDs[index].games.push(games[i]);
    }
  }
  
  gamesByNumDVDs.sort(function(a, b) {
    return b.numDVDsPerGame - a.numDVDsPerGame;
  });
  
  return {
    totalSizeBytes: totalSizeBytes,
    totalNumDVDs  : totalNumDVDs,
    gamesByNumDVDs: gamesByNumDVDs
  };
}

function logGameList(games) {
  var columns = [
    {
      key   : 'title',
      header: 'Title'
    },
    {
      key   : 'platform',
      header: 'Platform'
    },
    {
      key   : SIZE_DISPLAY === 'original'? 'origSizeStr' : 'sizeStr',
      header: 'Size',
      alignRight: true
    },
    {
      key   : 'numDVDs',
      header: 'DVDs',
      alignRight: true
    }
  ];
  
  for (var i = 0; i < columns.length; ++i) {
    columns[i].header = columns[i].header || '';
    columns[i].length = columns[i].header.length;
  }
  
  for (var i = 0; i < games.length; ++i) {
    for (var j = 0; j < columns.length; ++j) {
      var value = games[i][columns[j].key];
      var str = typeof value === 'string'? value : JSON.stringify(value) || '';
      
      if (str.length > columns[j].length) {
        columns[j].length = str.length;
      }
    }
  }
  
  var row1Str = '';
  var row2Str = '';
  for (var i = 0; i < columns.length; ++i) {
    if (i > 0) {
      row1Str += ' | ';
      row2Str += '-|-';
    }
    
    row1Str += padStr(columns[i].header, columns[i].length);
    row2Str += padStr('', columns[i].length, '-');
  }
  
  console.log(row1Str);
  console.log(row2Str);
  
  for (var i = 0; i < games.length; ++i) {
    var rowStr = '';
    
    for (var j = 0; j < columns.length; ++j) {
      if (j > 0) {
        rowStr += ' | ';
      }
      
      var value = games[i][columns[j].key];
      var str = typeof value === 'string'? value : JSON.stringify(value) || '';
      
      rowStr += padStr(str, columns[j].length, ' ', columns[j].alignRight);
    }
    
    console.log(rowStr);
  }
}

function padStr(str, targetLength, padStr, alignRight) {
  padStr     = padStr     || ' ';
  alignRight = alignRight || false;
  
  while (str.length < targetLength) {
    if (alignRight) {
      str = padStr + str;
    }
    else {
      str += padStr;
    }
  }
  
  return str;
}



(function main() {
  // read the games from the game list
  var gameListFilepath = './gameList.txt';
  readGameList(gameListFilepath, function(err, games) {
    if (err) {
      console.error('Error reading game list at "' + gameListFilepath + '".');
      console.error(err);
      process.exit(1);
    }
    
    // calculate stats
    var stats = calculateStats(games);
    
    // report
    logGameList(games);
    
    console.log('');
    console.log('Read ' + games.length + ' games.');
    console.log('Total size: ' + numBytesToSizeString(stats.totalSizeBytes));
    console.log('Total DVDs: ' + stats.totalNumDVDs);
    
    for (var i = 0; i < stats.gamesByNumDVDs.length; ++i) {
      console.log(
        'Games with ' +
        stats.gamesByNumDVDs[i].numDVDsPerGame +
        ' DVDs: ' +
        stats.gamesByNumDVDs[i].games.length
      );
    }
    
    process.exit(0);
  });
})();