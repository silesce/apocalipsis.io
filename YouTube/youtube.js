var config = {
    clientId: '746242678989-c41d2u915r29keud93bjej9gr1h0ssat.apps.googleusercontent.com',
    redirectUri: 'http://silesce.github.io/YouTube/youtube.html',
    scopes: ['https://www.googleapis.com/auth/yt-analytics.readonly','https://www.googleapis.com/auth/youtube.readonly']
};

$(document).ready(function() {

    console.clear();

    var accessToken = parseAccessToken();
    var hasAuth = accessToken && accessToken.length > 0;
    updateUIWithAuthState(hasAuth);

    $("#from").datepicker({ defaultDate: '01/01/2000' });
    $("#to").datepicker();

    $("#connectbutton").click(function() {
          doAuthRedirect();
    });

});

function parseScopes() {
  var scopes=config.scopes[0];
  for(var i=1;i<config.scopes.length;i++){
    scopes+="%20"+config.scopes[i]
  };
  return scopes
}


function doAuthRedirect() {
    var url = 'https://accounts.google.com/o/oauth2/v2/auth?scope='+ parseScopes()
                +'&redirect_uri='+ config.redirectUri
                +'&response_type=token&client_id='+config.clientId;
    console.log(url);
    window.location.href = url;
}


function parseAccessToken() {
    var query = window.location.hash.substring(1);
    var vars = query.split("&");
    var ii;
    for (ii = 0; ii < vars.length; ++ii) {
       var pair = vars[ii].split("=");
       if (pair[0] == "access_token") { return pair[1]; }
    }
    return(false);
}



function handleAuthResult(authResult) {
    hasAuth = authResult && !authResult.error;
    updateUIWithAuthState(hasAuth);
    tableau.password = authResult.access_token;
}

function updateUIWithAuthState(hasAuth) {
    if (hasAuth) {
        $(".notsignedin").css('display', 'none');
        $(".signedin").css('display', 'block');
    } else {
        $(".notsignedin").css('display', 'block');
        $(".signedin").css('display', 'none');
    }
}


//------------- Helper Functions -------------//
 function buildUrl(startDate, endDate, startIndex, results) {
    var url = 'https://www.googleapis.com/youtube/analytics/v1/reports?ids=channel%3D%3DMINE'+
                '&start-date='+startDate+'&end-date='+endDate+
                '&metrics=views%2Clikes%2Cdislikes%2Ccomments%2Cshares%2CestimatedMinutesWatched%2CaverageViewDuration'+
                '&dimensions=video%2Cchannel'+
                '&max-results='+results+
                '&sort=-views'+
                '&start-index='+startIndex;
    return url;
  }


//------------- Tableau WDC code -------------//
var myConnector = tableau.makeConnector();
var fieldNames;

myConnector.init = function() {
  var accessToken = parseAccessToken();
  var hasAuth = (accessToken && accessToken.length > 0) || tableau.password.length > 0;

  if (tableau.phase == tableau.phaseEnum.interactivePhase || tableau.phase == tableau.phaseEnum.authPhase) {
      if (hasAuth) {
          tableau.password = accessToken;
          if (tableau.phase == tableau.phaseEnum.authPhase) {
              tableau.submit()
          }
      }
  }

    /* Update UI */
  updateUIWithAuthState(hasAuth);

  if (tableau.phase == tableau.phaseEnum.interactivePhase) {
     if (!hasAuth) {
        $("#getvenuesbutton").css('display', 'none');     }
  }

  if (tableau.phase == tableau.phaseEnum.authPhase) {
    $("#getvideosbutton").css('display', 'none');
  }

  $("#getvideosbutton").click(function() {

        var startDate = $.datepicker.formatDate('yy-mm-dd',($("#from").datepicker('getDate')));
        var endDate = $.datepicker.formatDate('yy-mm-dd',($("#to").datepicker('getDate')));
        var maxRecords = $("#records").val();

        tableau.connectionData = JSON.stringify({'startDate': startDate, 'endDate': endDate, 'maxRecords': maxRecords});
        tableau.connectionName = "YouTube Data";
        tableau.alwaysShowAuthUI = true;
        tableau.submit();  // This ends the UI phase
  });

  tableau.initCallback();
};


myConnector.getColumnHeaders = function() {
    fieldNames = ["Video ID","Channel ID","month","insightTrafficSourceType","Views","Likes","Dislikes","Comments","Shares","Estimated Minutes Watched","Avg View Duration (s)", "subscribersGained"];
    var fieldTypes = ["string","string","string","string","int","int","int","int","int","int","int","int"];
    tableau.headersCallback(fieldNames, fieldTypes);
};


myConnector.getTableData = function(lastRecordToken) {

        var dataToReturn = [];
        var hasMoreData = false;
        var connectionData = JSON.parse(tableau.connectionData);

        var record = lastRecordToken? parseInt(lastRecordToken) : 1;
        var results = parseInt(connectionData.maxRecords)-record+1 > 200 ? 200 : parseInt(connectionData.maxRecords)-record+1;

        var xhr = $.ajax({url: buildUrl(connectionData.startDate,connectionData.endDate,record,results),
                          dataType: 'json',
                          headers: {'Authorization': 'Bearer '+tableau.password},
                          success: function (data) {
                              if (data.rows) {

                                for (var i=0; i<data.rows.length; i++) {
                                  var entry={};
                                  for (var k=0; k<fieldNames.length; k++){
                                    entry[fieldNames[k]]= data.rows[i][k];
                                  }
                                  dataToReturn.push(entry);
                                  record++;
                                }

                                record--;
                                console.log(record);
                                tableau.dataCallback(dataToReturn,""+record,record<connectionData.maxRecords && record==200);

                              }

                              else {tableau.abortWithError("No videos found");}
                          },
                          error: function (xhr, ajaxOptions, thrownError) {
                              // If the connection fails, log the error and return an empty set.
                              tableau.log("Connection error: " + xhr.responseText + "\n" + thrownError);
                              tableau.abortWithError("Error while trying to connect to YouTube.");
                          }
                        });

};


// Register the tableau connector--call this last
tableau.registerConnector(myConnector);
