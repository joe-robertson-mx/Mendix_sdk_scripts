import {MendixSdkClient, Project, OnlineWorkingCopy, Revision, Branch} from 'mendixplatformsdk/dist';
import {IModel,domainmodels, microflows, projects, datatypes} from 'mendixmodelsdk/dist';
import {Microflow} from './mendix-component-creators/Microflow';
import { eServices as config} from '../config' 

// expressions for supported attribute types
// https://apidocs.mendix.com/modelsdk/latest/modules/domainmodels.html
const typeSplitExpressions: { [id: string]: (variableName: string) => string; } = {
   "DomainModels$BooleanAttributeType" : (variableName: string) => `${variableName}`,
   "DomainModels$CurrencyAttributeType" : (variableName: string) => `${variableName} != empty and ${variableName} > 0`,
   "DomainModels$DateTimeAttributeType" : (variableName: string) => `${variableName} != empty`,
   "DomainModels$DecimalAttributeType" : (variableName: string) => `${variableName} != empty and ${variableName} > 0`,
   "DomainModels$EnumerationAttributeType" : (variableName: string) => `${variableName} != empty`,
   "DomainModels$FloatAttributeType" : (variableName: string) => `${variableName} != empty and ${variableName} > 0`,
   "DomainModels$IntegerAttributeType" : (variableName: string) => `${variableName} != empty and ${variableName} > 0`,
   "DomainModels$LongAttributeType" : (variableName: string) => `${variableName} != empty and ${variableName} > 0`,
   "DomainModels$StringAttributeType" : (variableName: string) => `${variableName} != empty and ${variableName} != ''`
};

const client = new MendixSdkClient(config.auth.username, config.auth.apikey);
const project = new Project(client,config.project.id, config.project.name);



async function execute(){   
    const workingCopy = await client.platform().createOnlineWorkingCopy(project, new Revision(
        -1, new Branch(project, (config.project.branch === "") ? "" : config.project.branch))); // we'll always use the latest revision
    
    const domainModels = getDomainModels(workingCopy);

    createMicroflows(workingCopy, domainModels);

    workingCopy.commit((config.project.branch === "") ? null : config.project.branch)
        .done(
            () => {
                console.log("Commit complete. Please update your project in the modeller.");
            },
            error => {
                console.log("Something went wrong.");
                console.dir(error);
            });
};

execute();

function getDomainModels(workingCopy: OnlineWorkingCopy) {            
    var moduleNames = config.app.modules.map(function(m) {return m.name;});
    var domainModels : domainmodels.IDomainModel[] = workingCopy.model()
        .allDomainModels()
        .filter(dm => {             
            for (var i = 0; i < moduleNames.length; i++) {
                if(dm.containerAsModule.name === moduleNames[i]){
                    return true;
                }
            }

            return false;                
        });

    return domainModels;
}

function createMicroflows(workingCopy: OnlineWorkingCopy, domainModels : domainmodels.IDomainModel[]) {    
    domainModels.map(function(dm){
        let module : projects.IModule = dm.containerAsModule;
        console.log( `--> ${module.name}`);
        let folder : projects.IFolderBase = createFolder(dm.containerAsFolderBase, config.app.folderName);       
        // filter entities that should be processed based on the configuration (no entities configured will process all)
        let moduleConfig =config.app.modules.filter(m=> m.name == module.name)[0];            
        let entities : domainmodels.IEntity[] = dm.entities;
        if(moduleConfig.entities && moduleConfig.entities.length > 0){
            entities = dm.entities.filter(e=>{
                for (var i = 0; i < moduleConfig.entities.length; i++){
                    if (e.name === moduleConfig.entities[i]){
                        return true;
                    }
                }
                return false;
            });
        }

        // create a microflow for each entity
        entities.map(function(entity){
            var microflowName = config.app.validationMicroflowPrefix + entity.name;
            console.log( `\t${entity.name} -> ${microflowName}`);
            var mf = workingCopy.model().findMicroflowByQualifiedName(module.name + '.' + microflowName);
            if( !mf ){          
                createValidationMicroflow(workingCopy.model(),microflowName, module, entity, folder);
            }
            else{
                console.log( `\t\t!!! Microflow '${microflowName}' not created. A microflow with that name already exists.`);
            }                        
        })
        console.log( `<-- ${module.name}`);
    })
}

function createFolder(folderBase : projects.IFolderBase, folderName: string): projects.IFolderBase {
    let folder = folderBase.folders.find(f=>f.name == folderName);
    if( !folder ){
        folder = projects.Folder.createIn(folderBase);
        folder.name = folderName;
    }  
    return folder; 
}

function createValidationMicroflow(model: IModel, microflowName : string, module: projects.IModule, entity : domainmodels.IEntity, folder : projects.IFolderBase) {
    let lastActivity : microflows.MicroflowObject;

    const mfReturnType = datatypes.BooleanType.create(model);
    let microflow : Microflow = new Microflow(model, folder, microflowName, mfReturnType);
    
    var inputParameter_Customer = datatypes.ObjectType.create(model);
    inputParameter_Customer.entity = entity;
    microflow.addInputParameter(inputParameter_Customer.entity.name, inputParameter_Customer);    
    
    // START
    const startEvent = microflow.generateStartEvent();
    microflow.addObjectToMicroflow(
        startEvent, 0, 0, null, Microflow.ConnectorPosition.Right, Microflow.ConnectorPosition.Left);
    lastActivity = startEvent;

    // IS VALID VARIABLE
    const createVariableActivity_IsValidType = datatypes.BooleanType.create(model);
    const createVariableActivity_IsValid = microflow.generateCreateVariableActivity(
        createVariableActivity_IsValidType, config.app.validVariableName, 'true');    
        microflow.addObjectToMicroflow(
            createVariableActivity_IsValid, 100, 0, lastActivity, Microflow.ConnectorPosition.Right,Microflow.ConnectorPosition.Left);
    lastActivity = createVariableActivity_IsValid;
    
    // ATTRIBUTE VALIDATION
    entity.attributes.forEach((attribute, index) => {
        lastActivity = addValidationActivities(microflow, entity, attribute,lastActivity);
    })

    // END
    const endEvent = microflow.generateEndEvent(`$${config.app.validVariableName}`);
    microflow.addObjectToMicroflow(
        endEvent, 100, 0, lastActivity, Microflow.ConnectorPosition.Right, Microflow.ConnectorPosition.Left);
    lastActivity = endEvent;
}

function addValidationActivities(microflow : Microflow, entity : domainmodels.IEntity, attribute : domainmodels.IAttribute, connectFromObject: microflows.MicroflowObject): microflows.MicroflowObject {
    // check if we have a type split expression template defined for the attribute
    const splitExpressionTemplate = typeSplitExpressions[attribute.type.structureTypeName];

    // if we have no expression template, we cannot add the activities
    if(!splitExpressionTemplate){        
        console.log(`Will not add validation activity for attribute ${attribute.name}. No split expression found for ${attribute.type.structureTypeName}.`);
        return connectFromObject;
    }

    const variableName= `$${entity.name}/${attribute.name}`;    
    const splitExpression = splitExpressionTemplate(variableName);
    const exclusiveSplit = microflow.generateExcusiveSplit(splitExpression, `${attribute.name}`);
    microflow.addObjectToMicroflow(
        exclusiveSplit, 200, 0, connectFromObject, Microflow.ConnectorPosition.Right, Microflow.ConnectorPosition.Left);

    const changeVariableActivity = microflow.generateChangeVariableActivity(config.app.validVariableName, "false");
    const caseValue_false = microflow.generateEnumerationCase("false");
    microflow.addObjectToMicroflow(
        changeVariableActivity, 0, 100, exclusiveSplit, Microflow.ConnectorPosition.Bottom,Microflow.ConnectorPosition.Top,caseValue_false);

    const feedbackActivity = microflow.generateValidationFeedbackActivity(entity, attribute, config.app.requiredFieldMessage);
    microflow.addObjectToMicroflow(
        feedbackActivity, 200, 0, changeVariableActivity, Microflow.ConnectorPosition.Right, Microflow.ConnectorPosition.Left);
        
    const merge = microflow.generateMerge();    
    microflow.addObjectToMicroflow(
        merge, 0, -100, feedbackActivity, Microflow.ConnectorPosition.Top, Microflow.ConnectorPosition.Bottom);

    const caseValue_true = microflow.generateEnumerationCase("true");
    microflow.addSequenceFlow(
		exclusiveSplit, merge, Microflow.ConnectorPosition.Right, Microflow.ConnectorPosition.Left, caseValue_true);

    return merge;
}