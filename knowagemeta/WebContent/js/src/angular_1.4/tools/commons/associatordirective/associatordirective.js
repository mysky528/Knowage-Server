(function() {
	var scripts = document.getElementsByTagName("script");
	var currentScriptPath = scripts[scripts.length - 1].src;
	currentScriptPath = currentScriptPath.substring(0, currentScriptPath.lastIndexOf('/') + 1);
	
var associatorDirective = angular.module('associator-directive', ['ngMaterial']);
associatorDirective.directive("associatorDirective",function(){
	debugger;
		return {
//			restrict: 'E',
//			templateUrl:'/knowagemeta/js/src/angular_1.4/tools/commons/associatordirective/template/associatorDirectiveTemplate.jsp',
			templateUrl: currentScriptPath + 'template/associatorDirectiveTemplate.jsp',
			controller: associatorDirectiveController,
			scope: {
				sourceColumnLabel:"=",
				targetColumnLabel:"=",
				sourceModel:"=",
				targetModel:"=",
				sourceName:"@",
				targetName:"@",
				associatedItem:"@?",
				associatedParentPath:"@?",
				dragOptions:"=?",
				beforeDeleteAssociation:"&?",
				afterDeleteAssociation:"&?",
				multivalue:"=?"
			},
			 link: function (scope, element, attrs, ctrl, transclude) {

				 if(!attrs.associatedItem){
					 scope.associatedItem="links";
					 scope.$watch('targetModel', function() {
						 if (scope.targetModel != undefined || scope.targetModel != null)
							 scope.targetModel.forEach(function(entry) {
								 entry.links = [];
							 });
					 });
				 }
             }
		};
	});

function associatorDirectiveController($scope){
	$scope.deleteRelationship=function(item,index){
		var execute=true;
		if($scope.beforeDeleteAssociation!=undefined){
			execute= $scope.beforeDeleteAssociation({item:item,index:index})
		}
		if(execute!=false){
			if(index==undefined){
				item[$scope.associatedItem]=[];
			}else{
				item[$scope.associatedItem].splice(index,1);
			}
			if ($scope.$root.$$phase != '$apply' && $scope.$root.$$phase != '$digest') {
	    	    $scope.$apply();
	    	}
		}

		if($scope.afterDeleteAssociation!=undefined){
			execute= $scope.afterDeleteAssociation({item:item,index:index})
		}
	};

	$scope.getAssociatedParentName=function(item){
		if(item==undefined)return;
		try{
			if($scope.associatedParentPath!=undefined){
				var splittedPath=$scope.associatedParentPath.split(".");
				var pattern={};
				angular.copy(item,pattern);
				for(var i=0;i<splittedPath.length;i++){
					pattern=pattern[splittedPath[i]];
				}
				return pattern+".";
			}
		}catch(exception){
			console.error("error while generate the parent path (associationDirective). check the value of associated-parent-path.",exception.message)
		}
		return "";

	}
}
associatorDirective.directive('draggable', function() {
    return {
        scope: {
        	item: '='
        },
        link: function(scope, element) {
	        // this gives us the native JS object
	        var el = element[0];

	        el.draggable = true;

	        el.addEventListener(
	            'dragstart',
	            function(e) {
	                e.dataTransfer.effectAllowed = 'move';
	                e.dataTransfer.setData('itemIndex', this.id.split("-")[1]);
	                this.classList.add('drag');
	                return false;
	            },
	            false
	        );

	        el.addEventListener(
	            'dragend',
	            function(e) {
	                this.classList.remove('drag');
	                return false;
	            },
	            false
	        );
	    }
    }
});

associatorDirective.directive('droppable', function($timeout) {
    return {
        scope: {
        	drop: '&', // parent
        	item: '='
        },
        link: function(scope, element) {
            // again we need the native object
            var el = element[0];

            function updateItemSize(){
            	if(scope.item[scope.$parent.associatedItem]!=undefined && scope.item[scope.$parent.associatedItem].length>1){
		    		el.style.height=scope.item[scope.$parent.associatedItem].length*36+"px";
		    		 el.classList.add('multyValue');
		    	}else{
		    		el.style.height="";
		    		el.classList.remove('multyValue');
		    	}
		    	if (scope.$root.$$phase != '$apply' && scope.$root.$$phase != '$digest') {
		    	    scope.$apply();
		    	}
            }

            if(scope.$parent.multivalue==true){
            	var firstInit=true;
            	scope.$watch(function(){
            		return scope.item[scope.$parent.associatedItem]!=undefined ? scope.item[scope.$parent.associatedItem].length : 0 ;
            	},function(newVal,oldVal){
            		if(newVal!=oldVal || firstInit){
            			updateItemSize();
            			firstInit=false;
            		}
            	})
            }

            el.addEventListener(
            	    'dragover',
            	    function(ev) {
            	    	var data = ev.dataTransfer.getData("itemIndex");

            	    	var accept=true;
        			    if(scope.$parent.dragOptions && scope.$parent.dragOptions.hasOwnProperty("accept")){
        			    	accept=scope.$parent.dragOptions.accept(ev,scope.item) ;
                	    }

        			    if (scope.$parent.multivalue!=true &&  scope.item[scope.$parent.associatedItem]!=undefined && scope.item[scope.$parent.associatedItem].length > 0){
        			    	accept=false;
        			    }

        			    if(accept!=false){
        			    	ev.dataTransfer.dropEffect = 'move';
        			    	// allows us to drop
        			    	if (ev.preventDefault) ev.preventDefault();
        			    	this.classList.add('over');

        			    }

            	        return false;
            	    },
            	    false
            	);

            el.addEventListener(
            	    'dragenter',
            	    function(e) {
            	        this.classList.add('over');
            	        return false;
            	    },
            	    false
            	);

        	el.addEventListener(
        	    'dragleave',
        	    function(e) {
        	        this.classList.remove('over');
        	        return false;
        	    },
        	    false
        	);

        	el.addEventListener(
        		    'drop',
        		    function(ev) {
        		        // Stops some browsers from redirecting.
        		        if (ev.stopPropagation) ev.stopPropagation();

        		        this.classList.remove('over');
        		        var data = ev.dataTransfer.getData("itemIndex");

        			    var executeDrop=true;
        			    if(scope.$parent.dragOptions && scope.$parent.dragOptions.hasOwnProperty("beforeDrop")){
        			    	executeDrop=scope.$parent.dragOptions.beforeDrop(ev,scope.$parent.sourceModel[data],scope.item) ;
                	    }
        			    if(executeDrop!=false){

        			    	if(scope.item[scope.$parent.associatedItem]==undefined){
        			    		scope.item[scope.$parent.associatedItem]=[];
        			    	}
        			    	if(scope.$parent.multivalue==true && scope.item[scope.$parent.associatedItem].indexOf(scope.$parent.sourceModel[data])!=-1){
        			    		var classList=this.classList;
        			    		 classList.add('errorClass');
        			    		 $timeout(function(){
        			    			 classList.remove('errorClass');
        			    		 },500)

        			    		return
        			    	}
        			    	scope.item[scope.$parent.associatedItem].push(scope.$parent.sourceModel[data]);

        			    	updateItemSize();

        			    	if(scope.$parent.dragOptions && scope.$parent.dragOptions.hasOwnProperty("dropEnd")){
        			    		scope.$parent.dragOptions.dropEnd(ev,scope.$parent.sourceModel[data],scope.item);
        			    	}
        			    }else{
        			    	var classList=this.classList;
   			    		 classList.add('errorClass');
   			    		 $timeout(function(){
   			    			 classList.remove('errorClass');
   			    		 },500)

   			    		return
        			    }

        		        return false;
        		    },
        		    false
        		);
        }
    }
});

})();