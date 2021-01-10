import {IModel, projects, pages, microflows, datatypes, texts, domainmodels, Model} from "mendixmodelsdk/dist"

export class Microflow {
	private _model: IModel;
	private _microflow : microflows.Microflow;
	private _inputParameterCurrentX : number = -100;
	private _inputParameterCurrentY : number = 0;
	private _inputParameterXOffset : number = 100;
	private _inputParameterYOffset : number = 0;
	private _microflowCurrentX : number = 0;
	private _microflowCurrentY : number = 100;

	constructor(model: IModel, folder : projects.IFolderBase, name : string, returnType : datatypes.DataType) {
		this._model = model;
		this._microflow = microflows.Microflow.createIn(folder);
		this._microflow.name = name;

		this._microflow.objectCollection = microflows.MicroflowObjectCollection.create(folder.model);
        this._microflow.microflowReturnType = returnType;
		this._microflow.allowConcurrentExecution = true;

		let concurrencyErrorMessageTranslation = texts.Translation.create(model);
        concurrencyErrorMessageTranslation.languageCode = "en_US";
		let concurrencyErrorMessage = texts.Text.create(model);
        concurrencyErrorMessage.translations.push(concurrencyErrorMessageTranslation);
        this._microflow.concurrencyErrorMessage = concurrencyErrorMessage;
	}

	addInputParameter(parameterName : string, variableType : datatypes.DataType) {
		this._inputParameterCurrentX = this._inputParameterCurrentX + this._inputParameterXOffset;
		this._inputParameterCurrentY = this._inputParameterCurrentY + this._inputParameterYOffset;

		console.log (parameterName)

		let inputParameter = microflows.MicroflowParameterObject.create(this._model);
        inputParameter.relativeMiddlePoint = {"x":this._inputParameterCurrentX,"y":this._inputParameterCurrentY};
        inputParameter.size = {"width":30,"height":30};
        inputParameter.name = parameterName;
        inputParameter.variableType = variableType;
		this._microflow.objectCollection.objects.push(inputParameter);
	}

	addObjectToMicroflow(
		objectToAdd : microflows.MicroflowObject, xOffset : number = 0, yOffset : number = 0,
		connectFromObject : microflows.MicroflowObject | null,
		connectorPositionFrom : Microflow.ConnectorPosition = Microflow.ConnectorPosition.Right, 
		connectorPositionTo : Microflow.ConnectorPosition = Microflow.ConnectorPosition.Left,
		caseValue : microflows.CaseValue | null = null) {

		this._microflow.objectCollection.objects.push(objectToAdd);

		// set position of object in flow
		this._microflowCurrentX = this._microflowCurrentX + xOffset;
		this._microflowCurrentY = this._microflowCurrentY + yOffset;
		
		objectToAdd.relativeMiddlePoint = {"x":this._microflowCurrentX,"y":this._microflowCurrentY};

		if(connectFromObject) {
			this.addSequenceFlow(connectFromObject,objectToAdd,connectorPositionFrom,connectorPositionTo, caseValue);
		}					
	}

	addSequenceFlow(
		connectFromObject : microflows.MicroflowObject,
		connectToObject : microflows.MicroflowObject,
		connectorPositionFrom : Microflow.ConnectorPosition = Microflow.ConnectorPosition.Right, 
		connectorPositionTo : Microflow.ConnectorPosition = Microflow.ConnectorPosition.Left,
		caseValue : microflows.CaseValue | null = null) {
		let sequenceFlow = microflows.SequenceFlow.create(this._model);
        sequenceFlow.originConnectionIndex = connectorPositionFrom;
        sequenceFlow.destinationConnectionIndex = connectorPositionTo;
        sequenceFlow.originBezierVector = {"width":0,"height":0};
        sequenceFlow.destinationBezierVector = {"width":0,"height":0};
		sequenceFlow.caseValue = caseValue || microflows.NoCase.create(this._model);
		sequenceFlow.origin = connectFromObject;
		sequenceFlow.destination = connectToObject;
		
		this._microflow.flows.push(sequenceFlow);
	}

	generateStartEvent() : microflows.StartEvent {
		let startEvent = microflows.StartEvent.create(this._model);
		startEvent.size = {"width":20,"height":20};
		
		return startEvent;
	}

	generateEndEvent(returnValue : string) : microflows.EndEvent {
		let endEvent = microflows.EndEvent.create(this._model);
        endEvent.size = {"width":20,"height":20};
        endEvent.returnValue = returnValue;

		return endEvent;
	}

	generateCreateVariableActivity(variableType : datatypes.DataType, variableName: string, initialValue : string) : microflows.ActionActivity {
		let createVariable = microflows.CreateVariableAction.create(this._model);
		
		createVariable.variableType = variableType;
		createVariable.initialValue = initialValue;
		createVariable.variableName = variableName;
	
		let createVariableActivity = microflows.ActionActivity.create(this._model);
		createVariableActivity.action = createVariable;
	
		return createVariableActivity;
	}

	generateChangeVariableActivity(variableName: string, variableValue : string) : microflows.ActionActivity {
		let changeVariable = microflows.ChangeVariableAction.create(this._model);
        changeVariable.changeVariableName = variableName;
        changeVariable.value = variableValue;

        let changeVariableActivity = microflows.ActionActivity.create(this._model);
        changeVariableActivity.action = changeVariable;
	
		return changeVariableActivity;
	}

	generateExcusiveSplit(splitExpression: string, caption: string) : microflows.ExclusiveSplit {
		let exclusiveSplit = microflows.ExclusiveSplit.create(this._model);
        let splitCondition = microflows.ExpressionSplitCondition.create(this._model);
		splitCondition.expression = splitExpression;
		exclusiveSplit.splitCondition = splitCondition;
		exclusiveSplit.caption = caption;
		return exclusiveSplit;
	}

	generateMerge() : microflows.ExclusiveMerge {
		let merge = microflows.ExclusiveMerge.create(this._model);
		return merge;
	}

	generateEnumerationCase(caseValue : string) : microflows.EnumerationCase {
		let enumCaseValue = microflows.EnumerationCase.create(this._model);
		enumCaseValue.value = caseValue;
		
		return enumCaseValue;
	}

	generateValidationFeedbackActivity(entity : domainmodels.IEntity, attribute : domainmodels.IAttribute, message : string) : microflows.ActionActivity {
		let validationMessageTranslation = texts.Translation.create(this._model);
		validationMessageTranslation.languageCode = "en_US";
		validationMessageTranslation.text = message;
		
		let validationFeedbackAction = microflows.ValidationFeedbackAction.create(this._model);
        validationFeedbackAction.objectVariableName = entity.name;
        validationFeedbackAction.attribute = attribute;
        
        let validationTemplate = microflows.TextTemplate.createInValidationFeedbackActionUnderFeedbackTemplate(validationFeedbackAction);
		let validationText = texts.Text.createInTextTemplateUnderText(validationTemplate);					
		validationText.translations.push(validationMessageTranslation);
		
		let validationFeedbackActivity = microflows.ActionActivity.create(this._model);
		validationFeedbackActivity.action = validationFeedbackAction;		
		
		return validationFeedbackActivity;
	}

	generateLogMessage (pageName: string): microflows.ActionActivity {
	
		var userNameTemplateArgument = microflows.TemplateArgument.create(this._model);
		userNameTemplateArgument.expression = "$currentUser/Name"; 
	
		var nowTemplateArgument = microflows.TemplateArgument.create(this._model);
		nowTemplateArgument.expression = "formatDateTime([%CurrentDateTime%], 'dd/MM/yyyy HH:mm')";
	
		var IPAddressTemplateArgument = microflows.TemplateArgument.create(this._model);
		IPAddressTemplateArgument.expression = "$IPAddress"; 
	
		var browserTypeTemplateArgument = microflows.TemplateArgument.create(this._model);
		browserTypeTemplateArgument.expression = "$BrowserType"; 
	
		var logContentStringTemplate = microflows.StringTemplate.create(this._model);
		logContentStringTemplate.arguments.push(userNameTemplateArgument);
		logContentStringTemplate.arguments.push(nowTemplateArgument);
		logContentStringTemplate.arguments.push(IPAddressTemplateArgument);
		logContentStringTemplate.arguments.push(browserTypeTemplateArgument);
		logContentStringTemplate.text = "User: {1}, Date and time: {2}, Event type: Page access, Result: Success, IP address: {3}, Browser type: {4}\r\n";
	
		var logMessageAction = microflows.LogMessageAction.create(this._model);
		logMessageAction.level = microflows.LogLevel.Info;
		logMessageAction.node = `'Page accessed ${pageName}'`
		logMessageAction.messageTemplate = logContentStringTemplate;   // Note: for this property a default value is defined.
	
		var actionActivity = microflows.ActionActivity.create(this._model);
		actionActivity.action = logMessageAction;
		actionActivity.caption = "Page log";
		actionActivity.autoGenerateCaption = true;
		actionActivity.backgroundColor = microflows.ActionActivityColor.Gray;

		return actionActivity

	}

	generateJavaAction (name:string, useReturn: boolean, outputVarName: string|null):microflows.ActionActivity {
		var javaActionCallAction = microflows.JavaActionCallAction.create(this._model);
		javaActionCallAction.javaAction = this._model.findJavaActionByQualifiedName(name);
		javaActionCallAction.useReturnVariable = useReturn;
		if (outputVarName) {
			javaActionCallAction.outputVariableName = outputVarName;
		}

		let javaActionActivity = microflows.ActionActivity.create(this._model);
		javaActionActivity.action = javaActionCallAction;	

		return javaActionActivity
	}


	//Limitiations in the API mean this function does not currently work
	generateLoggingPageMicroflowCall (pageName:string): microflows.ActionActivity {
		//THE MICROFLOW CANNOT CURRENTLY BE AUTOMATED DUE TO THE PARAMETERS
		//Try this https://forum.mendixcloud.com/link/questions/87491
		//Try this https://forum.mendixcloud.com/link/questions/91422
		//Microflow call REPLACE WITH LOG!
		var microflowCall = microflows.MicroflowCall.create(this._model);
		microflowCall.microflow = this._model.findMicroflowByQualifiedName("CustomLogging.Sub_CreateLog");

		var LoggingResultParameterMapping = microflows.MicroflowCallParameterMapping.createIn(microflowCall);
		LoggingResultParameterMapping.argument = "CustomLogging.Enum_LoggingResult.Success";
		// (LoggingResultParameterMapping as any)["__parameter"].updateWithRawValue("CustomLogging.Sub_CreateLog.Result");

		var testParameter = this._model.findMicroflowParameterByQualifiedName("CustomLogging.Sub_CreateLog.Result")
		console.log (testParameter)
		LoggingResultParameterMapping.parameter = testParameter!;

		var EventTypeParameterMapping = microflows.MicroflowCallParameterMapping.createIn(microflowCall);
		EventTypeParameterMapping.argument = "CustomLogging.Enum_EventType.Page_access";
		(EventTypeParameterMapping as any)["__parameter"].updateWithRawValue("CustomLogging.Sub_CreateLog.EventType");

		var LogNodeNameParameterMapping = microflows.MicroflowCallParameterMapping.createIn(microflowCall);
		LogNodeNameParameterMapping.argument = `${pageName} accessed`;
		(LogNodeNameParameterMapping as any)["__parameter"].updateWithRawValue("CustomLogging.Sub_CreateLog.LogNodeName");

		var LoggingLevelParameterMapping = microflows.MicroflowCallParameterMapping.createIn(microflowCall);
		LoggingLevelParameterMapping.argument = "CustomLogging.Enum_LoggingLevel.Info";
		(LoggingLevelParameterMapping as any)["__parameter"].updateWithRawValue("CustomLogging.Sub_CreateLog.Enum_LogLevel");

		console.log (LoggingLevelParameterMapping)
		console.log (LoggingResultParameterMapping.parameter, EventTypeParameterMapping.parameter, LogNodeNameParameterMapping.parameter, LoggingLevelParameterMapping.parameter)
		var props = microflowCall.microflow?.allProperties()
		console.log (props)

		var templateArgument18 = microflows.TemplateArgument.create(this._model);
		//


		//Create the action
		var microflowCallAction = microflows.MicroflowCallAction.create(this._model);
		microflowCallAction.microflowCall = microflowCall;   // Note: for this property a default value is defined.
		microflowCallAction.useReturnVariable = true;

		let microflowCallActionActivity = microflows.ActionActivity.create(this._model);
		microflowCallActionActivity.action = microflowCallAction;	

		return microflowCallActionActivity

	}

	generatePageOpenCall (pageName:string, entityName: string|null): microflows.ActionActivity {
		
		var pageSettings = pages.PageSettings.create(this._model);
		pageSettings.page = this._model.findPageByQualifiedName(pageName); //This can be replaced by passing the IPage into the function

		var showPageAction = microflows.ShowPageAction.create(this._model);
		showPageAction.pageSettings = pageSettings;

		if (entityName) {
			showPageAction.passedObjectVariableName = entityName;
		}

		let showPageActionActivity = microflows.ActionActivity.create(this._model);
		showPageActionActivity.action = showPageAction;	
		
		return showPageActionActivity
	}
}

export namespace Microflow
{
    export enum ConnectorPosition
    {
        Top = 0,
        Right,
        Bottom,
        Left
    }
}