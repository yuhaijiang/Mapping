//指定名字和属性，并将更多的参数作为该节点的子节点，并自动将字符串转化成文本节点
function elt(name, attributes) {
	var node = document.createElement(name);
	if (attributes) {
		for (var attr in attributes)
			if (attributes.hasOwnProperty(attr))
				node.setAttribute(attr, attributes[attr]);
	}
	for (var i = 2; i < arguments.length; i++) {
		var child = arguments[i];
		if (typeof child == "string")
			child = document.createTextNode(child);
		node.appendChild(child);
	}
	return node;
}

//定义一个名为controls的对象，调用函数去初始化图片下方的各个控件
var controls = Object.create(null);

function createPaint(parent) {
	var canvas = elt("canvas", {
		width: 500,
		height: 300
	});
	var cx = canvas.getContext("2d");
	var toolbar = elt("div", {
		class: "toolbar"
	});
	for (var name in controls)
		toolbar.appendChild(controls[name](cx));

	var panel = elt("div", {
		class: "picturepanel"
	}, canvas);
	parent.appendChild(elt("div", null, panel, toolbar));
}

//对象把工具名和一个函数联系在一起，用户选择工具时会调用其对应的函数
var tools = Object.create(null);

controls.tool = function(cx) {
	var select = elt("select");
	for (var name in tools)
		select.appendChild(elt("option", null, name));
	cx.canvas.addEventListener("mousedown", function(event) {
		if (event.which == 1) {
			tools[select.value](event, cx);
			event.preventDefault();
		}
	});

	return elt("span", null, "Tool: ", select);
};

function relativePos(event, element) {
	var rect = element.getBoundingClientRect();
	return {
		x: Math.floor(event.clientX - rect.left),
		y: Math.floor(event.clientY - rect.top)
	};
}

function trackDrag(onMove, onEnd) {
	function end(event) {
		removeEventListener("mousemove", onMove);
		removeEventListener("mouseup", end);
		if (onEnd)
			onEnd(event);
	}
	addEventListener("mousemove", onMove);
	addEventListener("mouseup", end);
}

tools.Line = function(event, cx, onEnd) {
	cx.lineCap = "round";

	var pos = relativePos(event, cx.canvas);
	trackDrag(function(event) {
		cx.beginPath();
		cx.moveTo(pos.x, pos.y);
		pos = relativePos(event, cx.canvas);
		cx.lineTo(pos.x, pos.y);
		cx.stroke();
	}, onEnd);
};

tools.Erase = function(event, cx) {
	cx.globalCompositeOperation = "destination-out";
	tools.line(event, cx, function() {
		cx.globalCompositeOperation = "source-over";
	});
};

//颜色选择器
controls.color = function(cx) {
	var input = elt("input", {
		type: "color"
	});
	input.addEventListener("change", function() {
		cx.fillStyle = input.value;
		cx.strokeStyle = input.value;
	});
	return elt("span", null, "Color: ", input);
};

//配置画刷大小
controls.brushSize = function(cx) {
	var select = elt("select");
	var sizes = [1, 2, 3, 5, 8, 12, 25, 35, 50, 75, 100];
	sizes.forEach(function(size) {
		select.appendChild(elt("option", {
			value: size
		}, size + "pixels"));
	});
	select.addEventListener("change", function() {
		cx.lineWidth = select.value;
	});
	return elt("span", null, "Brush size: ", select);
};

controls.save = function(cx) {
	var link = elt("a", {
		href: "/"
	}, "Save");

	function update() {
		try {
			link.href = cx.canvas.toDataURL();
		} catch (e) {
			if (e instanceof SecurityError)
				link.href = "javascript:alert(" + JSON.stringify("Can't save: " + e.toString()) + ")";
			else
				throw e;
		}
	}
	link.addEventListener("mouseover", update);
	link.addEventListener("focus", update);
	return link;
};

//辅助函数，从一个URL加载一个图像文件并用它替换掉画布中的内容
function loadImageURL(cx, url) {
	var image = document.createElement("img");
	image.addEventListener("load", function() {
		var color = cx.fillStyle,
			size = cx.lineWidth;
		cx.canvas.width = image.width;
		cx.canvas.height = image.height;
		cx.drawImage(image, 0, 0);
		cx.fillStyle = color;
		cx.strokeStyle = color;
		cx.lineWidth = size;
	});
	image.src = url;
}

controls.apenFile = function(cx) {
	var input = elt("input", {
		type: "file"
	});
	input.addEventListener("change", function() {
		if (input.files.length == 0) return;
		var reader = new FileReader();
		reader.addEventListener("load", function() {
			loadImageURL(cx, reader.result);
		});
		reader.readAsDataURL(input.files[0]);
	});
	return elt("div", null, "Open file: ", input);
};

//将整个域打包到一个结构中，在按下ENTER键提交该结构时相应
controls.openURL = function(cx) {
	var input = elt("input", {
		type: "text"
	});
	var form = elt("form", null, "Open URL: ", input, elt("button", {
		type: "submit"
	}, "load"));
	form.addEventListener("submit", function(event) {
		event.preventDefault();
		loadImageURL(cx, form.querySelector("input").value);
	});
	return form;
};

//添加文本工具使用提示去询问用户需要绘制的字符串
tools.text = function(event, cx) {
	var text = prompt("Text:", "");
	if (text) {
		var pos = relativePos(event, cx.canvas);
		cx.font = Math.max(7, cx.lineWidth) + "px sans=serif";
		cx.fillText(text, pos.x, pos.y);
	}
};

tools.Spary = function(event, cx) {
	var radius = cx.lineWidth / 2;
	var area = radius * radius * Math.PI;
	var dotsPerTick = Math.ceil(area / 30);

	var currentPos = relativePos(event, cx.canvas);
	var spray = setInterval(function() {
		for (var i = 0; i < dotsPerTick; i++) {
			var offset = randomPointInRadius(radius);
			cx.fillRect(currentPos.x + offset.x, currentPos.y + offset.y, 1, 1);
		}
	}, 25);
	trackDrag(function(event) {
		currentPos = relativePos(event, cx.canvas);
	}, function() {
		clearInterval(spray);
	});
};

function randomPointInRadius(radius) {
	for (;;) {
		var x = Math.random() * 2 - 1;
		var y = Math.random() * 2 - 1;
		if (x * x + y * y <= 1)
			return {
				x: x * radius,
				y: y * radius
			};
	}
}