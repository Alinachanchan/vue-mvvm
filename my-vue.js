/**
 * Created by 10414 on 2017/8/2.
 */

var Vue = (function () {
    function observe(data) {
        if (!data || typeof data !== 'object') {   //这里包括数组和对象  typeof [] === 'object' 为true
            return;
        }
        Object.keys(data).forEach((key) => {
            defineReactive(data, key, data[key]);
        });
    }

    function defineReactive(obj, key, value) {
        var dep = new Dep();
        observe(value);    //递归监听  如果属性的值为对象  则递归监听
        if (value instanceof Array) {
            //对该数组的push  pop splice shift等等可以改变数组的方法进行装饰  并挂载到数组实例上
            ["push", "pop", "shift", "unfift", "splice"].forEach((method) => {
                // let beforeDecorateMethod = Array.prototype[method];
                value[method] = function (prop) {
                    let result = Array.prototype[method].call(value, prop)
                    dep.notify();
                    return result;
                }
            })
        }
        Object.defineProperty(obj, key, {
            configurable: false,        //不能再define
            enumerable: true,           //可枚举
            set: function (newValue) {
                if (newValue == value) return;
                value = newValue;
                dep.notify();
            },
            get: function () {
                if (Dep.target) {
                    dep.addWatcher(Dep.target);
                }
                return value;
            }
        })
    }

    function Dep() {
        this.subs = [];
    }

    Dep.prototype = {
        addWatcher: function (watcher) {
            this.subs.push(watcher);
        },
        notify: function () {
            this.subs.forEach((watcher) => {
                watcher.update();
            })
        }
    }
//Compile对象做的事情   解析el所有子元素的所有指令  初始化视图  创建Watcher 并绑定update函数  watcher会把自己加到相应的dep订阅器中
    function Compile(el, vm) {
        this.$vm = vm;
        this.$el = document.querySelector(el);
        this.$fragment = this.elementToFragment(this.$el);   //劫持el所有子元素  转化为fragment文档碎片   以免频繁在真实DOM树上读写 以提高性能
        this.init();
        this.$el.appendChild(this.$fragment);
    }

    Compile.prototype = {
        elementToFragment: function (el) {
            var container = document.createDocumentFragment();
            var child;
            while (child = el.firstChild) {
                container.appendChild(child);
            }
            return container;
        },
        init: function () {
            this.compileElement(this.$fragment);
        },
        compileElement: function (el) {
            var childNodes = el.childNodes, vm = this.$vm;
            [].slice.call(childNodes).forEach((node) => {
                var text = node.textContent;
                var reg = /\{\{(.*)\}\}/;    // 表达式文本
                if (node.nodeType == 1) {  //普通标签
                    this.compileAttrs(node);
                } else if (node.nodeType == 3 && reg.test(text)) { //#text
                    this.compileText(node);
                }
                if (node.childNodes && node.childNodes.length > 0) {
                    this.compileElement(node);         //递归调用
                }
            })
        },
        compileText: function (node) {     //当然这里需要匹配所有的{{exp}}  为每个不同的exp生成一个Watcher
            var text = node.textContent;
            var reg = /\{\{([a-z|1-9|_]+)\}\}/g;
            reg.test(text);
            var exp = RegExp.$1;
            new Wathcer(exp, this.$vm, function (value) {
                node.textContent = text.replace(reg, value);
            });
        },
        compileAttrs: function (node) {
            var complieUtils = this.complieUtils;
            var attrs = node.attributes, me = this;
            [].slice.call(attrs).forEach(function (attr) {
                if (me.isDirective(attr)) {
                    var dir = attr.name.substring(2).split(':')[0];
                    var exp = attr.value;
                    complieUtils[dir + '_compile'].call(me, node, attr, exp);

                }
            })
        },
        isDirective: function (attr) {   //通过name  value获取属性的键值
            return /v-*/.test(attr.name);  //判断属性名是否以v-开头
        },
        complieUtils: {
            model_compile: function (node, attr, exp) {
                node.addEventListener("keyup", (e) => {
                    this.$vm.$data[exp] = e.target.value;
                });
                node.removeAttribute(attr.name);
                new Wathcer(exp, this.$vm, function (value) {
                    node.value = value;
                });
            },
            bind_compile: function (node, attr, exp) {
                var attribute = attr.name.split(':')[1];
                node.removeAttribute(attr.name);
                new Wathcer(exp, this.$vm, function (value) {
                    node.setAttribute(attribute, value);
                });
            },
            show_compile: function (node, attr, exp) {
                node.removeAttribute(attr.name);
                new Wathcer(exp, this.$vm, function (value) {
                    node.style.visibility = value ? 'visible' : 'hidden';
                });
            },
            for_compile: function (node, attr, exp) {
                var forArr = exp.trim().split(' ');
                var indexVal = forArr[0];
                var realExp = forArr[2];
                var parentNode = node.parentNode;
                new Wathcer(realExp, this.$vm, (arr) => {
                    // console.log(arr);
                    parentNode.innerHTML = '';
                    for (var i = 0; i < arr.length; i++) {
                        let newNode = node.cloneNode(true);
                        // this.compileElement(newNode)
                        parentNode.appendChild(newNode);  //把所有子节点的v-指令以及{{}}的文本替换
                    }
                });
            }
        }
    }
    function Wathcer(exp, vm, callback) {
        this.exp = exp;
        this.vm = vm;
        this.callback = callback;
        Dep.target = this;
        this.get();
        Dep.target = null;
        this.callback(this.value);     //初始化试图
    }

    Wathcer.prototype = {
        get: function () {
            this.value = this.vm.$data[this.exp];
        },
        update: function () {
            this.get();    //先获得value值
            this.callback(this.value);
        }
    }

    return function Vue(options) {
        this.$options = options;
        var data = options.data;
        this.$data = data;
        this.$el = options.el;
        observe(data);        //劫持监听data所有属性
        this.$compile = new Compile(this.$el, this)  //模板解析
    }
})();
