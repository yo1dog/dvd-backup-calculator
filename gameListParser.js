var fs = require('fs');

var SORT =
//'size';
//'numDisks';
//'name';
'diskType';

var SIZE_DISPLAY =
'auto';
//'original';
//'gbs';
//'mbs';
//'kbs';
//'bytes';


var MAX_NUM_DISKS_PER_GAME = 2;

var BYTES_IN_KB = 1024;
var BYTES_IN_MB = 1024 * BYTES_IN_KB;
var BYTES_IN_GB = 1024 * BYTES_IN_MB;

var BYTES_BY_UNIT = {
  kb: BYTES_IN_KB,
  mb: BYTES_IN_MB,
  gb: BYTES_IN_GB
};

var DISK_TYPES = {
  DVD: {
    name: 'SL',
    sizeBytes: 4.7 * BYTES_IN_GB
  },
  /*
  DL_DVD: {
    name: 'DL',
    sizeBytes: 8.5 * BYTES_IN_GB
  },
  */
  BLU_RAY_DVD: {
    name: 'BR',
    sizeBytes: 25 * BYTES_IN_GB
  },
  DL_BLU_RAY_DVD: {
    name: 'DL BR',
    sizeBytes: 50 * BYTES_IN_GB
  }
};


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
  
  return numBytes + ' B';
}

function readGameList(gameListFilepath, cb) {
  fs.readFile(gameListFilepath, function(err, gameListStr) {
    if (err) {
      return cb(err);
    }
    
    var regex = /^([^#\|]+)\|([^\|]+)\|\s*(([\d\.]+)([kmg]b))\s*\|\s*(x?)\s*(\|(.*))?$/gmi;
    
    var games = [];
    var results;
    while((results = regex.exec(gameListStr))) {
      var title       = results[1].trim();
      var platform    = results[2].trim();
      var origSizeStr = results[3];
      var size        = parseFloat(results[4]);
      var sizeUnit    = results[5].toLowerCase();
      var backedUp    = results[6]? true : false;
      var notes       = results[8]? results[8].trim() : '';
      
      var bytesInUnit = BYTES_BY_UNIT[sizeUnit];
      var sizeBytes = Math.ceil(size * bytesInUnit);
      
      // chose the correct disk type for this size
      var diskType;
      var numDisks;
      
      for (var key in DISK_TYPES) {
        diskType = DISK_TYPES[key];
        numDisks = Math.ceil(sizeBytes / diskType.sizeBytes);
        
        if (numDisks <= MAX_NUM_DISKS_PER_GAME) {
          break;
        }
      }
      
      games.push({
        title      : title,
        platform   : platform,
        origSizeStr: origSizeStr,
        sizeBytes  : sizeBytes,
        diskType   : diskType,
        numDisks   : numDisks,
        backedUp   : backedUp,
        notes      : notes
      });
    }
    
    return cb(null, games);
  });
}

function sortGameList(games) {
  if (SORT === 'size') {
    games.sort(function(a, b) {
      return a.sizeBytes - b.sizeBytes;
    });
  }
  else if (SORT === 'numDisks') {
    games.sort(function(a, b) {
      // put larger disk types first
      var c = a.diskType.sizeBytes - b.diskType.sizeBytes;
      if (c !== 0) {
        return c;
      }
      
      c = a.numDisks - b.numDisks;
      if (c !== 0) {
        return c;
      }
      
      return a.title.localeCompare(b.title);
    });
  }
  else if (SORT === 'diskType') {
    games.sort(function(a, b) {
      // put larger disk types first
      var c = a.diskType.sizeBytes - b.diskType.sizeBytes;
      if (c !== 0) {
        return c;
      }
      
      return a.title.localeCompare(b.title);
    });
  }
  else {
    games.sort(function(a, b) {
      return a.title.localeCompare(b.title);
    });
  }
}

function calculateStats(games) {
  var totalSizeBytes   = 0;
  var numGamesBackedUp = 0;
  var totalNumDisks = 0;
  
  // total number of disks for each disk type. Ex:
  // {
  //   diskType: DISK_TYPES.DVD,
  //   totalNumDisks: 123
  // },
  // {
  //   diskType: DISK_TYPES.DL_DVD,
  //   totalNumDisks: 24
  // }
  var totalNumDisksByType = [];
  
  // number of games that require a certain number of disk. Ex:
  // {
  //   numDisksPerGame: 1,
  //   numGames: 123
  // },
  // {
  //   numDisksPerGame: 2,
  //   numGames: 42
  // },
  // {
  //   numDisksPerGame: 3,
  //   numGames: 11
  // }
  var numGamesByNumDisksPerGame = [];
  
  
  for (var i = 0; i < games.length; ++i) {
    totalSizeBytes += games[i].sizeBytes;
    totalNumDisks += games[i].numDisks;
    
    // add this game's number of disks to the total number of disks of type $games[i].diskType
    var index = -1;
    for (var j = 0; j < totalNumDisksByType.length; ++j) {
      if (totalNumDisksByType[j].diskType === games[i].diskType) {
        index = j;
        break;
      }
    }
    
    if (index === -1) {
      totalNumDisksByType.push({
        diskType     : games[i].diskType,
        totalNumDisks: games[i].numDisks
      });
    }
    else {
      totalNumDisksByType[index].totalNumDisks += games[i].numDisks;
    }
    
    // add this game to the number of games with $games[i].numDisks disks
    index = -1;
    for (var j = 0; j < numGamesByNumDisksPerGame.length; ++j) {
      if (numGamesByNumDisksPerGame[j].numDisksPerGame === games[i].numDisks) {
        index = j;
        break;
      }
    }
    
    if (index === -1) {
      numGamesByNumDisksPerGame.push({
        numDisksPerGame: games[i].numDisks,
        numGames       : 1
      });
    }
    else {
      ++numGamesByNumDisksPerGame[index].numGames;
    }
    
    // if this game has been backed up, add it to the total number of backed up games
    if (games[i].backedUp) {
      ++numGamesBackedUp;
    }
  }
  
  return {
    totalSizeBytes           : totalSizeBytes,
    totalNumDisks            : totalNumDisks,
    totalNumDisksByType      : totalNumDisksByType,
    numGamesByNumDisksPerGame: numGamesByNumDisksPerGame,
	  numGamesBackedUp         : numGamesBackedUp
  };
}

function logGameList(games) {
  var columns = [
    {
      header: 'Title',
      getValue: function(game) {return game.title;}
    },
    {
      header: 'Platform',
      getValue: function(game) {return game.platform;}
    },
    {
      header: 'Size',
      alignRight: true,
      getValue: function(game) {return SIZE_DISPLAY === 'original'? game.origSizeStr : numBytesToSizeString(game.sizeBytes);}
    },
    {
      header: 'Disks',
      alignRight: true,
      getValue: function(game) {return game.numDisks + ' ' + game.diskType.name;}
    },
    {
      header: 'B',
      getValue: function(game) {return game.backedUp? 'X' : '';}
    },
    {
      header: 'Notes',
      getValue: function(game) {return game.notes;}
    },
  ];
  
  for (var i = 0; i < columns.length; ++i) {
    columns[i].header = columns[i].header || '';
    columns[i].length = columns[i].header.length;
  }
  
  for (var i = 0; i < games.length; ++i) {
    for (var j = 0; j < columns.length; ++j) {
      var value = columns[j].getValue(games[i]);
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
      
      var value = columns[j].getValue(games[i]);
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
    
    // sort game list
    sortGameList(games);
    
    // calculate stats
    var stats = calculateStats(games);
    
    // sort the total number of disks by type
    stats.totalNumDisksByType.sort(function(a, b) {
      return a.diskType.sizeBytes - b.diskType.sizeBytes;
    });
    
    // sort the number of games by the number if disks per game
    stats.numGamesByNumDisksPerGame.sort(function(a, b) {
      return a.numDisksPerGame - b.numDisksPerGame;
    });
    
    // report
    logGameList(games);
    
    console.log('');
    console.log('Read ' + games.length + ' games.');
    console.log('Total size     : ' + numBytesToSizeString(stats.totalSizeBytes));
    console.log('Total num Disks: ' + stats.totalNumDisks);
    
    console.log('');
    for (var i = 0; i < stats.totalNumDisksByType.length; ++i) {
      console.log(
        'Total num ' + stats.totalNumDisksByType[i].diskType.name + 's: ' +
        stats.totalNumDisksByType[i].totalNumDisks
      );
    }
    
    console.log('');
    for (var i = 0; i < stats.numGamesByNumDisksPerGame.length; ++i) {
      console.log(
        'Games with ' +
        stats.numGamesByNumDisksPerGame[i].numDisksPerGame + ' Disk' +
        (stats.numGamesByNumDisksPerGame[i].numDisksPerGame !== 1? 's' : ' ') + ': ' +
        stats.numGamesByNumDisksPerGame[i].numGames
      );
    }
	
	console.log('');
	console.log('Games Backed Up: ' + stats.numGamesBackedUp);
	console.log('Games Not Backed Up: ' + (games.length - stats.numGamesBackedUp));
    
    process.exit(0);
  });
})();