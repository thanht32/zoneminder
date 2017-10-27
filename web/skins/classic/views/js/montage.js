var requestQueue = new Request.Queue( { concurrent: 2 } );

function Monitor( monitorData ) {
  this.id = monitorData.id;
  this.connKey = monitorData.connKey;
  this.server_url = monitorData.server_url;
  this.status = null;
  this.alarmState = STATE_IDLE;
  this.lastAlarmState = STATE_IDLE;
  this.streamCmdParms = "view=request&request=stream&connkey="+this.connKey;
  if ( auth_hash )
    this.streamCmdParms += '&auth='+auth_hash;
  this.streamCmdTimer = null;

  this.start = function( delay ) {
    this.streamCmdTimer = this.streamCmdQuery.delay( delay, this );
  };

  this.setStateClass = function( element, stateClass ) {
    if ( !element.hasClass( stateClass ) ) {
      if ( stateClass != 'alarm' )
        element.removeClass( 'alarm' );
      if ( stateClass != 'alert' )
        element.removeClass( 'alert' );
      if ( stateClass != 'idle' )
        element.removeClass( 'idle' );
      element.addClass( stateClass );
    }
  };

  this.getStreamCmdResponse = function( respObj, respText ) {
    if ( this.streamCmdTimer )
      this.streamCmdTimer = clearTimeout( this.streamCmdTimer );

    var stream = $j('#liveStream'+this.id )[0];
    if ( respObj.result == 'Ok' ) {
      this.status = respObj.status;
      this.alarmState = this.status.state;

      var stateClass = "";
      if ( this.alarmState == STATE_ALARM )
        stateClass = "alarm";
      else if ( this.alarmState == STATE_ALERT )
        stateClass = "alert";
      else
        stateClass = "idle";

      if ( !COMPACT_MONTAGE ) {
        $('fpsValue'+this.id).set( 'text', this.status.fps );
        $('stateValue'+this.id).set( 'text', stateStrings[this.alarmState] );
        this.setStateClass( $('monitorState'+this.id), stateClass );
      }
      this.setStateClass( $('monitor'+this.id), stateClass );

      /*Stream could be an applet so can't use moo tools*/
      stream.className = stateClass;

      var isAlarmed = ( this.alarmState == STATE_ALARM || this.alarmState == STATE_ALERT );
      var wasAlarmed = ( this.lastAlarmState == STATE_ALARM || this.lastAlarmState == STATE_ALERT );

      var newAlarm = ( isAlarmed && !wasAlarmed );
      var oldAlarm = ( !isAlarmed && wasAlarmed );

      if ( newAlarm ) {
        if ( false && SOUND_ON_ALARM ) {
          // Enable the alarm sound
          $('alarmSound').removeClass( 'hidden' );
        }
        if ( POPUP_ON_ALARM ) {
          windowToFront();
        }
      }
      if ( false && SOUND_ON_ALARM ) {
        if ( oldAlarm ) {
          // Disable alarm sound
          $('alarmSound').addClass( 'hidden' );
        }
      }
      if ( this.status.auth ) {
        if ( this.status.auth != auth_hash ) {
          // Try to reload the image stream.
          if ( stream )
            stream.src = stream.src.replace( /auth=\w+/i, 'auth='+this.status.auth );
          console.log("Changed auth to " + this.status.auth );
        }
      } // end if haev a new auth hash
    } else {
      console.error( respObj.message );
      // Try to reload the image stream.
      if ( stream ) {
        console.log('Reloading stream: ' + stream.src );
        stream.src = stream.src.replace(/rand=\d+/i, 'rand='+Math.floor((Math.random() * 1000000) ));
      } else {
        console.log( 'No stream to reload?' );
      }
    }
    var streamCmdTimeout = statusRefreshTimeout;
    if ( this.alarmState == STATE_ALARM || this.alarmState == STATE_ALERT )
      streamCmdTimeout = streamCmdTimeout/5;
    this.streamCmdTimer = this.streamCmdQuery.delay( streamCmdTimeout, this );
    this.lastAlarmState = this.alarmState;
  };

  this.streamCmdQuery = function( resent ) {
    //if ( resent )
    //console.log( this.connKey+": Resending" );
    //this.streamCmdReq.cancel();
    this.streamCmdReq.send( this.streamCmdParms+"&command="+CMD_QUERY );
  };

  this.streamCmdReq = new Request.JSON( { url: this.server_url, method: 'get', timeout: AJAX_TIMEOUT, onSuccess: this.getStreamCmdResponse.bind( this ), onTimeout: this.streamCmdQuery.bind( this, true ), link: 'cancel' } );

  requestQueue.addRequest( "cmdReq"+this.id, this.streamCmdReq );
}

function selectLayout( element ) {
  layout = $(element).get('value');

  if ( layout_id = parseInt(layout) ) {
    layout = layouts[layout];
console.log("Have layout # " + layout_id);

    for ( var i = 0; i < monitors.length; i++ ) {
      monitor = monitors[i];
      // Need to clear the current positioning, and apply the new

      monitor_frame = $j('#monitorFrame'+monitor.id);
      if ( ! monitor_frame ) {
        console.log("Error finding frame for " + monitor.id );
        continue;
      }

      // Apply default layout options, like float left
      if ( layout.default ) {
        styles = layout.default; 
        for ( style in styles ) {
console.log("applying " + style + ': ' + styles[style]);
          monitor_frame.css(style, styles[style]); 
        }
      } // end if default styles

      if ( layout[monitor.id] ) {
        styles = layout[monitor.id]; 
        for ( style in styles ) {
console.log("applying " + style + ': ' + styles[style]);
          monitor_frame.css(style, styles[style]); 
        }
      } // end if specific monitor style
    } // end foreach monitor
  }  // end if a stored layout
  if ( ! layout ) {
    return;
  }
  Cookie.write( 'zmMontageLayout', layout_id, { duration: 10*365 } );
  if ( layout_id != 1 ) { // 'montage_freeform.css' ) {
    Cookie.write( 'zmMontageScale', '', { duration: 10*365 } );
    $('scale').set('value', '' );
    $('width').set('value', '');

    for ( var x = 0; x < monitors.length; x++ ) {
      var monitor = monitors[x];
      var streamImg = $( 'liveStream'+monitor.id );
      if ( streamImg ) {
        if ( streamImg.nodeName == 'IMG' ) {
          var src = streamImg.src;
          streamImg.src='';
          src = src.replace(/width=[\.\d]+/i,'width=0' );
          src = src.replace(/rand=\d+/i,'rand='+Math.floor((Math.random() * 1000000) ));
          streamImg.src = src;
        } else if ( streamImg.nodeName == 'APPLET' || streamImg.nodeName == 'OBJECT' ) {
          // APPLET's and OBJECTS need to be re-initialized
        }
        streamImg.style.width = '100%';
      }
      var zonesSVG = $('zones'+monitor.id);
      if ( zonesSVG ) {
        zonesSVG.style.width = '';
      }
    } // end foreach monitor
  }
}

function changeSize() {
  var width = $('width').get('value');
  var height = $('height').get('value');

  for ( var x = 0; x < monitors.length; x++ ) {
    var monitor = monitors[x];
  
    // Scale the frame
      monitor_frame = $j('#monitorFrame'+monitor.id);
      if ( ! monitor_frame ) {
        console.log("Error finding frame for " + monitor.id );
        continue;
      }
      if ( width )
        monitor_frame.css('width',width+'px');
      if ( height )
        monitor_frame.css('height',height+'px');
    /*Stream could be an applet so can't use moo tools*/ 
    var streamImg = $( 'liveStream'+monitor.id );
    if ( streamImg ) {
      if ( streamImg.nodeName == 'IMG' ) {
        var src = streamImg.src;
        streamImg.src='';
        src = src.replace(/width=[\.\d]+/i,'width='+width );
        src = src.replace(/height=[\.\d]+/i,'height='+height );
        src = src.replace(/rand=\d+/i,'rand='+Math.floor((Math.random() * 1000000) ));
        streamImg.src = src;
      }
      streamImg.style.width = width? width + "px" : null;
      streamImg.style.height = height ? height + "px" : null;
      //streamImg.style.height = '';
    }
    var zonesSVG = $('zones'+monitor.id);
    if ( zonesSVG ) {
      zonesSVG.style.width = width ? width + "px" : '100%';
      zonesSVG.style.height = height + "px";
    }
  }
  $('scale').set('value', '' );
  Cookie.write( 'zmMontageScale', '', { duration: 10*365 } );
  Cookie.write( 'zmMontageWidth', width, { duration: 10*365 } );
  Cookie.write( 'zmMontageHeight', height, { duration: 10*365 } );
} // end function changeSize()

function changeScale() {
  var scale = $('scale').get('value');

  for ( var x = 0; x < monitors.length; x++ ) {
    var monitor = monitors[x];
    var newWidth = ( monitorData[x].width * scale ) / SCALE_BASE;
    var newHeight = ( monitorData[x].height * scale ) / SCALE_BASE;
    /*Stream could be an applet so can't use moo tools*/
    var streamImg = document.getElementById( 'liveStream'+monitor.id );
    if ( streamImg ) {
      if ( streamImg.nodeName == 'IMG' ) {
        var src = streamImg.src;
        streamImg.src='';

        //src = src.replace(/rand=\d+/i,'rand='+Math.floor((Math.random() * 1000000) ));
        src = src.replace(/scale=[\.\d]+/i,'scale='+ scale );
        src = src.replace(/width=[\.\d]+/i,'width='+newWidth );
        src = src.replace(/height=[\.\d]+/i,'height='+newHeight );
        streamImg.src = src;
      }
      streamImg.style.width = newWidth + "px";
      streamImg.style.height = newHeight + "px";
    }
    var zonesSVG = $('zones'+monitor.id);
    if ( zonesSVG ) {
      zonesSVG.style.width = newWidth + "px";
      zonesSVG.style.height = newHeight + "px";
    }
  }
  $('width').set('value', '');
  $('height').set('value', '');
  Cookie.write( 'zmMontageScale', scale, { duration: 10*365 } );
  Cookie.write( 'zmMontageWidth', '', { duration: 10*365 } );
  Cookie.write( 'zmMontageHeight', '', { duration: 10*365 } );
}

var monitors = new Array();
function initPage() {
  for ( var i = 0; i < monitorData.length; i++ ) {
    monitors[i] = new Monitor( monitorData[i] );
    var delay = Math.round( (Math.random()+0.5)*statusRefreshTimeout );
    monitors[i].start( delay );
  }
  selectLayout($('layout'));

    $j('#monitors .monitorFrame').draggable({
        cursor: 'crosshair',
        revert: 'invalid'
    });
    
    function toGrid(value) {
        return Math.round(value / 80) * 80;
    }
    
    $j('#monitors').droppable({
        accept: '#monitors .monitorFrame',
        drop: function(event, ui) {
            //console.log(event);
            $j(this).removeClass('border over');
            $j(ui.draggable).detach().
                appendTo($j(this).find('ul')).
                draggable({
                    containment: '.fw-content',
                    cursor: 'help',
                    grid: [ 80, 80 ]
                }).
                css({
                    position: 'absolute', 
                    left: toGrid(event.clientX - $j('#monitors').offset().left), 
                    top: toGrid(event.clientY - $j('#monitors').offset().top)
                });
        },
        over: function(event, elem) {
            console.log('over');
            $j(this).addClass('over');
        },
        out: function(event, elem) {
            $j(this).removeClass('over');
        }
    });
}

// Kick everything off
window.addEvent( 'domready', initPage );
