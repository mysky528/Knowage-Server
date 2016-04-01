var scorecardApp = angular.module('scorecardManager', [ 'ngMaterial',  'angular_table' ,'angular_list','sbiModule', 'angular-list-detail','bread_crumb','kpi_semaphore_indicator']);
scorecardApp.config(['$mdThemingProvider', function($mdThemingProvider) {
    $mdThemingProvider.theme('knowage')
    $mdThemingProvider.setDefaultTheme('knowage');
}]);

scorecardApp.service('scorecardManager_semaphoreUtility',function(){
	this.typeColor=['RED','YELLOW','GREEN','GRAY'];
	this.getPriorityStatus=function(a,b){
		return this.typeColor.indexOf(a)<this.typeColor.indexOf(b) ? a : b; 
	}
});

scorecardApp.service('scorecardManager_targetUtility',function(scorecardManager_semaphoreUtility){
	this.getTargetStatus=function(target){
		 
		if(angular.equals(target.criterion.valueId,228)){
			return loadTargetByMajority(target);
		}else{
			//load by priority
			if(target.criterionPriority.length==0){
				return loadTargetByMajority(target);
			}else{
				return loadTargetByMajorityWithPriority(target);
			}
		}
		
	};
	
	function loadTargetByMajorityWithPriority(target){
//		TO-DO
		return ["PINK"];
	};
	
	function loadTargetByMajority(target){ 
		var maxTargetCount=target.groupedKpis[0].count;
		var maxTarget=target.groupedKpis[0].status;
		for(var i=1;i<target.groupedKpis.length;i++){
			if(!angular.equals("GRAY",target.groupedKpis[i].status)){
				if(target.groupedKpis[i].count>maxTargetCount){
					maxTargetCount=target.groupedKpis[i].count;
					maxTarget=target.groupedKpis[i].status;
				}else if(target.groupedKpis[i].count==maxTargetCount){
					maxTargetCount=target.groupedKpis[i].count;
					maxTarget=scorecardManager_semaphoreUtility.getPriorityStatus(target.groupedKpis[i].status,maxTarget);
				}
			}
		} 
		
		 
		
		return maxTarget ;
	}
	
});

scorecardApp.controller('scorecardMasterController', [ '$scope','sbiModule_translate','sbiModule_restServices','$angularListDetail','$timeout',scorecardMasterControllerFunction ]);
scorecardApp.controller('scorecardListController', [ '$scope','sbiModule_translate','sbiModule_restServices','$angularListDetail','$timeout',scorecardListControllerFunction ]);
scorecardApp.controller('scorecardDetailController', [ '$scope','sbiModule_translate','sbiModule_restServices','$angularListDetail','$timeout',scorecardDetailControllerFunction ]);

function scorecardMasterControllerFunction($scope,sbiModule_translate,sbiModule_restServices,$angularListDetail,$timeout){
	$scope.translate=sbiModule_translate;
	$scope.emptyScorecard={name:"",perspectives:[]};
	$scope.emptyPerspective={name:"",criterion:{},status:"",groupedKpis:[],targets:[]};
	$scope.emptyTarget={name:"",criterion:{},status:"",groupedKpis:[],kpis:[]};
	$scope.currentScorecard= {};
	$scope.currentPerspective = {};
	$scope.currentTarget = {};
	$scope.selectedStep={value:0};
	
	$scope.broadcastCall=function(type){
		$scope.$broadcast(type);
	}
	
	
}

function scorecardListControllerFunction($scope,sbiModule_translate,sbiModule_restServices,$angularListDetail,$timeout){
	$scope.scorecardList=[];
	$scope.scorecardColumnsList=[
	                             {label:"Name",name:"name"},
	                             {label:"Data",name:"date"},
	                             {label:"Author",name:"author"}];
	
	$scope.newScorecardFunction=function(){
		angular.copy($scope.emptyScorecard,$scope.currentScorecard);  
//		for(var i=0;i<2;i++){
//			var tmp=angular.extend({}, $scope.emptyPerspective);
//			tmp.name="Prospettiva"+1;
//			tmp.groupedKpis=[{status:"RED",count:2},{status:"YELLOW",count:1},{status:"GREEN",count:3}];
//			$scope.currentScorecard.perspectives.push(tmp);
//		}
//		
		
		$angularListDetail.goToDetail();
	};
	
	$scope.loadScorecardList=function(){
		sbiModule_restServices.promiseGet("1.0/kpi","listScorecard")
		.then(function(response){
			$scope.scorecardList=response.data;
			},function(response){
				sbiModule_restServices.errorHandler(response.data,sbiModule_translate.load("sbi.kpi.scorecard.load.error"));
		});
	};
	
	$scope.loadScorecardList();
	
	
	/*Da aggiustare la comparazione per torvare l'elemento da eliminare,
	 *  aggiungere codice gestire l'eliminazione facendo la chiamata rest 
	 *  e in caso di successo, fare lo splice */
	$scope.scorecardListAction =  [{  label : 'Remove',
							        icon:'fa fa-trash' , 
							        backgroundColor:'trasparent',
							        action : function(item,event) {
							      	  pos = 0;
							      	  while ($scope.scorecardList[pos].name != item.name)
							      		  pos++;
							      	  $scope.scorecardList.splice(pos,1);
	         			           }}];
}

function scorecardDetailControllerFunction($scope,sbiModule_translate,sbiModule_restServices,$angularListDetail,$timeout){
	$scope.stepItem=[{name:'scorecard definition'}];
	
	$scope.stepControl; 
	$scope.criterionTypeList = [];
	
	$scope.saveScorecardFunction=function(){
		console.log($scope.currentScorecard);
		console.log($scope.currentPerspective);
		console.log($scope.currentTarget);
		
		
		sbiModule_restServices.promisePost("1.0/kpi","saveScorecard",$scope.currentScorecard)
		.then(function(response) {
			alert("Salvato");
		}, function(response) {
			sbiModule_messaging.showErrorMessage(response.data.errors[0].message, 'Error');
			});	
		
		
	}
	
	sbiModule_restServices.promiseGet("2.0/domains","listByCode/KPI_SCORECARD_CRITE")
	.then(function(response){ 
		angular.copy(response.data,$scope.criterionTypeList); 
		$scope.emptyPerspective.criterion=$scope.criterionTypeList[0];
		$scope.emptyTarget.criterion=$scope.criterionTypeList[0];
	},function(response){
		sbiModule_restServices.errorHandler(response.data,sbiModule_translate.load("sbi.kpi.rule.load.generic.error")+" domains->KPI_SCORECARD_CRITE"); 
	});
}