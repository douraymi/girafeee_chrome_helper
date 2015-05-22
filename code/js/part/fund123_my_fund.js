// http://my.fund123.cn/RealFundDefault.aspx
// for this url page

module.exports = function(){
	console.log("my_fund");
	C.css('css/part/fund123_my_fund.css');
	C.ng('html/part/fund123_my_fund.html', appController);

	function appController($scope){
		$scope.setting = {
			Bin 	: 30000,
			rate	: 0.5
		}

		// localStorage方式统计当天赎回总额
		C.storage.ngBind($scope, "todayRedeem", function(item){
			// console.log("item:", item);
			var today = new Date();
			if(item && item.date===today.toDateString() && item.redeemTr){
				// redeemTr渲染
				redeemClass(item.redeemTr);
			}else{
				var newItem = {
					todayRedeem:{
						date 					: today.toDateString(),
						redeemTr			: [],
						redeemAmount 	: 0
					}
				};
				C.storage.remove('todayRedeem');
				C.storage.set(newItem);
			}
		}, function(changes){
			// console.log("changes:", changes);
		});

		// scope 处理
		// 市值-底仓与盈利 按比例赎回
		var sj = $("#0 td:eq(4)").text().trim().replace(/[^0-9\.-]+/g,"") *1;
		var ljsy = $("#0 td:eq(7)").find("font:eq(0)").text().trim().replace(/[^0-9\.-]+/g,"") *1;
		$scope.pfToday = C.fxNum( ((sj - ($scope.setting.Bin + ljsy)) * $scope.setting.rate) , 2);

		// 根据金额随机选择 卖出基金
		$scope.randomRedeem = function(amount){
			var mTb = "#m_Table_open tbody tr.bb:not(.today_is_redeemed)";
			$(mTb).removeClass("hight_light");
			var tmpAry = [];
			var count = 0;
			while(count<amount){
				var size = $(mTb).size();
				var mvTr = $(mTb).eq( _.random(0, size-1) ).remove();	// 随机选一行
				count += mvTr.find("td:eq(4)").text().trim().replace(/[^0-9\.-]+/g,"") * 1;
				tmpAry.push(mvTr);
			}
			_.each(tmpAry, function(trObj){
				trObj.addClass("hight_light");
				trObj.insertBefore($(mTb).eq(0));
				// 处理另外一行
				var anotherTr = "#TR2"+trObj.attr("id").slice(2);
				$(anotherTr).remove().insertAfter($(mTb).eq(0));
			});
		}

		// 赎回信息传递
		function redeemTunnel(parentid, fundCode, perVal, fenE){
			$("#TR2_"+parentid).css("display","none");
			// 赎回出错修正
			M.connect("my_fund", fundCode+"redeem", function(tnRedeem){
				var redeemMsgObj = {
					redeemRedeem : {
						fix : function(msg){
							console.log("in fix");
							if(msg.body.fixFenE){
								var _newBalance = Number(fenE) - Number(msg.body.fixFenE);
								if(_newBalance>0){
									// $("#TR2_"+parentid).css("display","none");
									$("#TR_"+parentid).removeClass('hight_light').addClass('today_is_redeemed');
									C.storage.get('todayRedeem', function(items){
										var _ra = items["todayRedeem"]["redeemAmount"]+ _newBalance*1*perVal;
										_ra = C.fxNum(_ra, 2);
										items["todayRedeem"]["redeemTr"].push(parentid);
										C.storage.set({
											todayRedeem:{
												date 					: items["todayRedeem"]["date"],
												redeemTr 			: items["todayRedeem"]["redeemTr"],
												redeemAmount 	: _ra
											}
										}, function(){
											tnRedeem.send({type:"redeemRedeem", code:"fix", body:{isDone:true}});
										});
									});
									
								}else{
									console.log("_newBalance:", _newBalance);
									tnRedeem.send({type:"redeemRedeem", code:"fix", body:{isDone:true}});
								}

							}
						}
					}
				}

				tnRedeem.onMsg(redeemMsgObj);
				tnRedeem.onClose.addListener(function(){
					tnRedeem.close();
				});
			});

			// 赎回操作
			var redeemQ = 0;
			M.connect("my_fund", fundCode+"confirm", function(tnConfirm){
				var confirmMsgObj = {
					redeemConfirm : {
						onLoad : function(msg){
							redeemQ = msg.body.redeemQ;
						}
					}
				};
				var confirmOnCloseFunc = function(){
					M.connect("my_fund", fundCode+"done", function(tnDone){
						var doneMsgObj = {
							redeemDone : {
								onLoad : function(msg){
									if(msg.body.isRedeemOk){
										// $("#TR2_"+parentid).css("display","none");
										$("#TR_"+parentid).removeClass('hight_light').addClass('today_is_redeemed');
										C.storage.get('todayRedeem', function(items){
											var _ra = items["todayRedeem"]["redeemAmount"]+redeemQ*1*perVal;
											_ra = C.fxNum(_ra, 2);
											items["todayRedeem"]["redeemTr"].push(parentid);
											C.storage.set({
												todayRedeem:{
													date 					: items["todayRedeem"]["date"],
													redeemTr 			: items["todayRedeem"]["redeemTr"],
													redeemAmount 	: _ra
												}
											});
										});
									}
								}
							}
						};

						tnDone.onMsg(doneMsgObj);
						tnDone.onClose.addListener(function(){
							tnDone.close();
						});
					});
					tnConfirm.close();
				}

				tnConfirm.onMsg(confirmMsgObj);
				tnConfirm.onClose.addListener(confirmOnCloseFunc);
			});
		};

		function redeemClass(redeemTrAry){
			_.each(redeemTrAry, function(parentid){
				$("#TR_"+parentid).removeClass('hight_light').addClass('today_is_redeemed');
			});
		}

		function mainProcess(parentUrl, day90redeem){
			var _url = new URI(parentUrl);
			_url.hasQuery("parentid", function(parentid){
				var _code = $("span[parentid="+parentid+"]").attr("code");
				var _perVal = $("#TR_"+parentid).find("td:eq(1) a:eq(0)").text().trim().replace(/[^0-9\.-]+/g,"");
				var _fenE = $("#TR_"+parentid).find("td:eq(3)").text().trim().replace(/[^0-9\.-]+/g,"");
				redeemTunnel(parentid, _code, _perVal, _fenE);
				if(day90redeem != undefined){
					// console.log(day90redeem);
					M.connect("my_fund", _code+"day90redeem", function(tn){
						// console.log("in day90redeem");
						// tn.onMsg({
						// 	day90redeem : {
						// 		tnOk : function(msg){
									tn.send({type:"day90redeem", code:"day90redeem", body:{day90redeem: day90redeem}});
						// 		}
						// 	}
						// });
						tn.onClose.addListener(function(){
							tn.close();
						});
					});
				}
			});
			
		}

		// DOM 处理
		$("#a_trade_redeem").click(function(){
			mainProcess($(this).attr("href"));
		});

		function tradeLink(){
			var _tUrl = "#m_Table_open div.opt>span.left>a:contains('赎回')";
			$(_tUrl).bind("DOMNodeInsertedIntoDocument", function(celm){
				// console.log(celm.target);
				var day90redeem = 0;
				$(celm.target).parents("#fundInner:eq(0)").find("div.tb tr.ct").each(function(i, tr){
					var _shyk = $(tr).find("td:eq(7)").text().trim().replace(/[^0-9\.-]+/g,"")*1;
					if(_shyk > 0 || _shyk < 0 ){
						var _fday = $(tr).find("td:eq(1) span:eq(0)").attr("title").trim().replace(/[^0-9\.-]+/g,"")*1;
						if(_fday > 92){
							day90redeem += $(tr).find("td:eq(4)").text().trim().replace(/[^0-9\.-]+/g,"")*1;
						}else if(_fday>0 && _fday<=92){
							 return false;
						}
					}
				});
				day90redeem = day90redeem>0?day90redeem:-1;
				$(celm.target).click(function(){
					console.log("day90redeem@@", day90redeem);
					mainProcess($(celm.target).attr("href"), day90redeem);
				});
			});

		}
		tradeLink();
		$("#OpenTable").bind("DOMNodeInserted", function(elm){
			if(elm.target.id == "m_Table_open" ){
				C.storage.get('todayRedeem', function(items){
					if(items.todayRedeem && items.todayRedeem.redeemTr) redeemClass(items.todayRedeem.redeemTr);
				});
			}
			tradeLink();
		});


	}




}();