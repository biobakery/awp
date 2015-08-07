var settings = {
    api_url: "/api"
    , event_colors : { init:   "primary", skip:    "default", fail:    "danger",
		     finish: "primary", success: "success", execute: "info" }

    , status_colors : { skip: "#777",    fail:      "#f2dede", done: "#dff0d8",
			wait: "#5bc0de", undefined: "#777" }
    , event_to_status : { skip: "skip", execute: "wait", success: "done",
			  fail: "fail" }
    , status_to_event_color : { skip: "default", fail: "danger", wait: "info",
				done: "success", undefined: "default"}
    , new_event_hooks: {}
    , MAX_EVENTS : 100
    , dag: { initial_scale: 0.75 }
};

const util = {
    lt : function (val, argidx){
	argidx = ! (argidx)? 0: argidx;
	return function (){
	    return arguments[argidx] < val;
	};
    }
    , gt : function (val, argidx){
	argidx = ! (argidx)? 0: argidx;
	return function (){
	    return arguments[argidx] > val;
	};
    }
    , keys : function (obj){
	var thekeys = new Array;
	for (prop in obj){ 
	    if (obj.hasOwnProperty(prop))
		thekeys.push(prop);
	}
	return thekeys;
    }
    , values : function (obj){
	var thevals = new Array;
	for (prop in obj){ 
	    if (obj.hasOwnProperty(prop))
		thevals.push(obj[prop]);
	}
	return thevals;
    }
    , update : function (obj_a, obj_b) {
	for (prop in obj_b) {
	    if (! obj_b.hasOwnProperty(prop))
		continue;
	    obj_a[prop] = obj_b[prop];
	}
    }
    , each : function (arr, fn){
	for (var i = 0, len = arr.length; i < len; i++)
	    fn(arr[i]);
    }
    , has : function (obj, key){
	return (obj[key] !== undefined && obj.hasOwnProperty(key));
    }
    , last : function (arr){
	var l = arr.length; return l > 0? arr[l-1] : undefined;
    }
    , repeat : function(x, times){
	var ret = new Array();
	for (var i = 0; i < times; i++)
	    ret.push(x);
	return ret;
    }
    , format : function(s, vals){
	util.keys(vals).map(function(key){
	    s = s.replace("{"+key+"}", vals[key]);
	});
	return s;
    }
    , escapeMap : {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': '&quot;',
	"'": '&#39;',
	"/": '&#x2F;'
    }
    , escapeHtml : function(s) {
	return String(s).replace(/[&><"'\/]/g, function(r){
	    return util.escapeMap[r];
	});
    }
    , maybe : function(x, alt) { return x === undefined? alt : x; }
    , id : function(x) { return x; }
    , bool : function(x) { return x? true : false; }
};

const api = {
    get : function (url){
	url = url === undefined? "" : url;
	return $.getJSON(settings.api_url+"/"+url);
    }
};

const render = {
    time : function(s){
	return ('<p><span class="glyphicon glyphicon-time"></span>'+
		'&nbsp; '+s+' seconds</p>');
    }
    , files : function(f_arr) {
	if (f_arr.length == 0)
	    return "";
	var content = '<strong>Targets</strong>';
	content += '<table style="table-layout:fixed;" class="table table-striped">';
	content += ('<thead><tr><th style="width:75%;">Filename</th>'+
		    '<th>Size (Bytes)</th></tr></thead>');
	content += '<tbody>';
	util.each(f_arr, function(f){
	    content += '<tr>';
	    content += '<td style="width:75%; overflow: scroll"><code>'+f[0]+'</code></td>';
	    content += '<td>'+f[1]+'</td>';
	    content += '</tr>';
	});
	content += '</tbody></table>';
	return content;
    }
    , list : function(arr) {
	var content = '<ul>';
	util.each(arr, function(item){
	    content += '<li>'+item+'</li>';
	});
	content += '</ul>';
	return content;
    }
    , exception : function(s) {
	return ('<div class="alert alert-danger"'+
		  '<span class="glyphicon glyphicon-flash"></span>'+
		  '&nbsp; Exception: '+s+
		'</div>');
    }
    , outerr : function(s_arr, label){
	var content = ''
	, outs = s_arr.filter(util.id);
	if (outs.length == 0)
	    return '';
	content += '<p>';
	content += '<strong>'+label+'</strong>';
	util.each(outs, function(str){
	    content += '<pre>'+util.escapeHtml(str)+'</pre>';
	});
	content += '</p>';
	return content;
    }
    , stdout : function (s_arr){return render.outerr(s_arr, 'Stdout');}
    , stderr : function (s_arr){return render.outerr(s_arr, 'Stderr');}
};

function on_new_event_slider(e){
    var title = e.data.name === undefined? e.type : task_basename(e.data.name) + " - " + e.type
    , $events = $('#events')
    , event_template = (
	'<div class="panel panel-{color}">'+
	  '<div class="panel-heading">'+
	    '<span class="glyphicon glyphicon-menu-down pull-left pointy" '+
	           'onclick="toggle_event_view(this);" '+
	           'style="padding: 2px 10px 0px 0px;"></span>'+
	    '<h4 class="panel-title">{t}</h4>'+
	  '</div>'+
	  '<div class="panel-body show">'+
	    '{content}'+
	  '</div>'+
	'</div>');

    var thedate = new Date(e.time*1000)
    , content = '<h4><small>'+thedate.toString()+'</small></h4>';

    if (e.type == "fail")
	content += render.exception(e.data.exc);

    if (e.type == "success" || e.type == "fail") {
	content += render.time(e.data.time);
	content += render.stdout(e.data.outs);
	content += render.stderr(e.data.errs);
    }

    if (e.type == "success")
	content += render.files(e.data.targets);
    
    if (e.type == "execute")
	content += render.list(e.data.file_dep);

    $events.prepend(
	util.format(event_template,{t: title
				    , color: settings.event_colors[e.type]
				    , content: content})
    );

    var cs = $events.children();
    if (cs.length > settings.MAX_EVENTS)
	for (var i = cs.length-1; i > settings.MAX_EVENTS; i--)
	    $(cs[i]).remove();
}

function show_task(t){
    var $task_view = $('#task').empty()
    , html = (
	'<div class="panel panel-{color}">'+
	  '<div class="panel-heading">'+
	    '<span class="glyphicon glyphicon-remove pull-left pointy" '+
	           'style="padding: 2px 10px 0px 0px;" '+
	           'onclick="$(this).parent().parent().empty();"></span>'+
	    '<h4 class="panel-title">{t}</h4>'+
	  '</div>'+
	  '<div class="panel-body">'+
	    '{content}'+
	  '</div>'+
	'</div>'
    );

    var title = task_basename(t.data.name) + " - Status: " + t.status;

    var content = '<h4><small>Started '+t.start.toString()+'</small></h4>';

    if (util.has(t, "stop"))
	content += '<h4><small>Ended '+t.stop.toString()+'</small></h4>';
    if (util.has(t.data, "time"))
	content += render.time(t.data.time);
    if (util.has(t.data, "outs"))
	content += render.stdout(t.data.outs);
    if (util.has(t.data, "errs"))
	content += render.stderr(t.data.errs);
    if (util.has(t.data, "targets"))
	content += render.files(t.data.targets);
    if (util.has(t.data, "file_dep")){
	content += "<strong>Dependent Files</strong>";
	content += render.list(t.data.file_dep);
    }

    $task_view.html(html.
		    replace("{t}", title).
		    replace("{color}",settings.status_to_event_color[t.status]).
		    replace("{content}", content));
    
}

function toggle_event_view(el) {
    var dn = "glyphicon-menu-down"
    , up = "glyphicon-menu-up"
    , $el = $(el);
    if (el.className.match(/-up/)){
	$el.parent().siblings().removeClass("hidden").addClass("show");	
	$el.removeClass(up).addClass(dn);
    } else {
	$el.parent().siblings().removeClass("show").addClass("hidden");
	$el.removeClass(dn).addClass(up);
    }
}

function message(level, msg, duration){
    var duration = duration === undefined? 3000 : duration
    , to_append = $(
	'<div class="alert alert-'+level+'" role="alert"><b>'+level+':  </b>'
	    +msg+
	    '</div>'
    );

    $("#messages").append(to_append);
    setTimeout(function(){
	to_append.fadeTo(500,0).slideUp(500, function(){$(this).remove();});
    }, duration);
}

function project_load_error(_, _, reason){
    $("available_projects").empty();
    message("danger", "Unable to load projects: "+reason);
}

function load_projects(el){
    if (el === undefined)
	return;

    api.get().
	fail(project_load_error).
	done(function(data, status){
	    if (status !== "success") return project_load_error();
	    $("#available_projects").empty();
	    $("#available_projects").append(
		data.projects.map(function(p){
		    return '<li><a href="#'+p+'">'+p+'</a></li>';
		})
	    );
	});
}

function switch_nav(name) {
    $(".nav li").removeClass("active");
    $("#"+name+"_nav").addClass("active");
    $("div.vis_row").removeClass("show").addClass("hidden");
    $("#"+name).removeClass("hidden").addClass("show");
    if (name == "gannt") {
	if ($("#gannt").children().length == 0)
	    draw_project_gannt();
    } else if (name == "dag") {
	if ($("#dag > svg > g").children().length == 0)
	    draw_project_dag();
    } else if (name == "events") {
	// do nothing
    }
}

function project_route() {
    var project_name = window.location.hash.replace("#", "");
    if (project_name) return draw_project(project_name);
}

function task_basename(t){
    var arr = t.split(":");
    return arr.filter(util.lt(arr.length-1, 1)).join(":");
}

function stdevent(e_arr){
    return {type: e_arr[0], time: e_arr[1], data: e_arr[2]};
}

function new_event(e) {
    util.each(util.values(settings.new_event_hooks),
	      function(hook_fn){ hook_fn(stdevent(e)); });
}

function subscribe_project(name) {
    settings.new_event_hooks.slider = on_new_event_slider;
    settings.new_event_hooks.timeline = window.timeline.add_event;
    var host = window.location.origin.replace("http://", "")
    , url = "ws://"+host+settings.api_url+"/"+name+"/socket"
    , sock = new WebSocket(url);
    sock.onmessage = function(event) {
	$.parseJSON(event.data).map(new_event);
    };
}

function draw_project_dag() {
    var data = window.data
    , nodes_obj = new Object
    , svg = d3.select("#dag svg")
    , inner = d3.select("#dag g")
    , g = new dagreD3.graphlib.Graph().setGraph({rankdir:"LR"})
    , render = new dagreD3.render()
    , zoom = d3.behavior.zoom().on("zoom", function() {
	inner.attr("transform", "translate("+d3.event.translate+")"+
		                    "scale("+d3.event.scale+")");
    });

    util.each(data.tree, function(n){
	if (n[0] === 0) return;
	g.setNode(n[0], {label: task_basename(n[0]),
			 rx: 5, ry: 5});
    });
    util.each(data.tree, function(n){
	var the_color;
	if (n[0] === 0) return;
	var deps = n[1].task_dep, node = g.node(n[0]);
	util.each(deps, function(dep){
	    g.setEdge(dep, n[0], {label: ""});
	});
	if (util.has(window.timeline.tasks, n[0]))
	    the_color = settings.status_colors[
		util.maybe(window.timeline.tasks[n[0]].status, n[1].status)
	    ];
	else
	    the_color = settings.status_colors[n[1].status];
	node.style = "fill: " + the_color;
    });
    settings.new_event_hooks.dag = function(e) {
	if (e.data.name === undefined)
	    return;
	var color = settings.status_colors[settings.event_to_status[e.type]];
	g.node(e.data.name).elem.children[0].style.fill = color;
    };
    svg.call(zoom);
    render(inner, g);
    zoom.
	translate([(svg.attr("width") - g.graph().width * settings.dag.initial_scale) / 2, 20]).
	scale(settings.dag.initial_scale).
	event(svg);
    svg.attr("height", g.graph().height*settings.dag.initial_scale + 40);
    d3.selectAll("g.node").
	classed("pointy", true).
	on("click", function(name){
	    show_task(window.timeline.tasks[name]);
	});
}

window.timeline = {
    lanes: [[]]
    , tasks: {}
    , callbacks : {}
    , newest : new Date()
    , oldest : undefined

    , _update_tasks : function (e) {
	var t;
	window.timeline.newest = new Date(e.time*1000);
	window.timeline.oldest = util.maybe(window.timeline.oldest,
					    window.timeline.newest);
	if ( ! util.has(window.timeline.tasks, e.data.name))
	    t = window.timeline.tasks[e.data.name] = {data: {}};
	else
	    t = window.timeline.tasks[e.data.name];
	
	util.update(t.data, e.data);

	switch (e.type) {
	case "execute":
	    t.status = "wait";
	    t.start = window.timeline.newest;
	    break;
	case "skip":
	    t.status = "skip";
	    t.start = t.stop = window.timeline.newest;
	    break;
	case "success":
	    t.status = "done";
	    t.stop = window.timeline.newest;
	    break;
	case "fail":
	    t.status = "fail";
	    t.stop = window.timeline.newest;
	    break;
	}
	return t;
    }

    , clear : function() {
	window.timeline.lanes = [[]];
	window.timeline.tasks = {};
    }

    , _add_event : function(e) {
	if (e.data.name === undefined) return undefined;
	var t = window.timeline._update_tasks(e);
	if (util.has(t, "lane")) return t;
	for (var i = 0; i < window.timeline.lanes.length; i++){
	    var lane = window.timeline.lanes[i], latest = util.last(lane);
	    if (   (latest === undefined)
		|| (latest.stop !== undefined && latest.stop < t.start)) {
		t.lane = i;
		lane.push(t);
		return t;
	    }
	}
	t.lane = window.timeline.lanes.length;
	window.timeline.lanes.push([t]);
	return t;
    }

    , add_event : function(e){
	var maybe_t = window.timeline._add_event(e);
	if (maybe_t !== undefined)
	    util.each(util.values(window.timeline.callbacks),
		      function(cb) { cb(maybe_t); });
    }
};

function draw_project_gannt() {
    var margin = {top: 40, right: 5, bottom: 30, left: 5 }
    , width = 900 - margin.left - margin.right
    , height = 550 - margin.top - margin.bottom
    , start = window.timeline.oldest
    , tl = window.timeline
    , n_workers = tl.lanes.length;

    if (start === undefined)
	start = new Date(window.data.events[0][1]*1000);

    var x = d3.time.scale().domain([start, tl.newest]).range([5, width])
    , y = d3.scale.ordinal().domain(d3.range(n_workers)).
	    rangeRoundBands([0, height], 0.1);

    var xAxis = d3.svg.axis().scale(x).orient("bottom")
    , yAxis = d3.svg.axis().scale(y).orient("left").tickFormat('');

    d3.select("#gannt svg").remove();

    var svg = d3.select("#gannt").append("svg").
	attr("width", width + margin.left + margin.right).
	attr("height", height + margin.top + margin.bottom).
	append("svg:g").
	attr("transform", 
	     "translate(" + margin.left + "," + margin.top + ")");

    svg.append("g").
	attr("class", "x axis").
	attr("transform", "translate(0,"+height+")").
	call(xAxis);

    svg.append("g").
	attr("class", "y axis").
	call(yAxis);

    function setup_lanes() {
	return svg.selectAll(".gannt").
	    data(tl.lanes).
	    enter().append("g").
	    attr("class", "g");
    }
    
    function format_rect_static(selection) {
	selection.
	    attr("rx", 5).
	    attr("ry", 5).
	    classed("gannt pointy", true).
	    style("stroke", "#000");
    }

    function format_rect(selection) {
	selection.
	    attr("width", function(t){
		return x(util.maybe(t.stop, tl.newest))-x(t.start);
	    }).
	    attr("height", y.rangeBand()).
	    attr("x", function(t){ return x(t.start); }).
	    attr("y", function(t){ return y(t.lane); }).
	    style("fill", function(t){
		return settings.status_colors[t.status];
	    });
    }

    function add_rect_listeners(selection) {
	selection.
	    on("click", show_task).
	    on("mouseover", function(t){ 
		return window.tooltip.
		    style("visibility", "visible").
		    text(task_basename(t.data.name));
	    }).
	    on("mousemove", function(){ 
		return window.tooltip.
		    style("top", (d3.event.pageY-10)+"px").
		    style("left", (d3.event.pageX+10)+"px");
	    }).
	    on("mouseout", function(){ 
		return window.tooltip.style("visibility", "hidden"); 
	    });
    }
    
    var lanes = setup_lanes();

    lanes.selectAll("rect").data(util.id).enter().append("rect").
	call(format_rect_static).
	call(format_rect).
	call(add_rect_listeners);


    window.timeline.callbacks.gannt = function(task) {
	n_workers = tl.lanes.length;
	x = d3.time.scale().domain([start, tl.newest]).range([5, width]);
	y = d3.scale.ordinal().domain(d3.range(n_workers)).
	    rangeRoundBands([0, height], 0.1);
	xAxis = d3.svg.axis().scale(x).orient("bottom");
	yAxis = d3.svg.axis().scale(y).orient("left").tickFormat('');
	d3.selectAll("rect.gannt").transition().call(format_rect);
	if (!util.has(lanes, task.lane))
	    lanes.append("g").attr("class", "g");
	if (task.status == "wait" || task.status == "skip"){
	    d3.select(lanes[0][task.lane]).
		data([task]).append("rect").
		call(format_rect_static).
		call(format_rect).
		call(add_rect_listeners);
	}
	// transition x and y axes after modifying rects is important
	svg.select(".x").transition().call(xAxis);
	svg.select(".y").transition().call(yAxis);
    };
    
}

function draw_project(name) {
    $("#project_title").empty().
	html('<h1>Project status for <a href="#'+name+'">'+name+'</a></h1>'+
	     '<p><a href="'+settings.api_url+'/'+name+'/log.zip"> '+
	     '<span class="glyphicon glyphicon-download"></span>'+
	     ' &nbsp; Download logs</a></p>');
    
    api.get(name).
	fail(function(_, _, reason){message("danger", reason);}).
	done(function(data, status){
	    if (status !== "success") return message(
		"danger", "Unexpected project load status "+status);
	    window.data = data;
	    subscribe_project(name);
	    util.each(data.events, new_event);
	    settings.new_event_hooks.reloader = function(e){
		if (e.type == "init") window.location.reload();
	    };
	});
}

$(function() {
    project_route();
    window.onhashchange = project_route;
    window.tooltip = d3.select("body").
	append("div").
	style("position", "absolute").
	style("z-index", "10").
	style("visibility", "hidden").
	text("");
});
