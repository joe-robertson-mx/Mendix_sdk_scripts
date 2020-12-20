import {MendixSdkClient, Project, OnlineWorkingCopy, Revision, Branch} from 'mendixplatformsdk/dist';
import {IModel, IStructure, microflows, projects, datatypes, domainmodels, pages} from 'mendixmodelsdk/dist';
import {Microflow} from './mendix-component-creators/Microflow';
import fs = require('fs')
import when = require('when');
var path = require('path');

import { DemoApplication as config} from '../config' 


const client = new MendixSdkClient(config.auth.username, config.auth.apikey);
const project = new Project(client,config.project.id, config.project.name);

async function execute(){   
    const workingCopy = await client.platform().createOnlineWorkingCopy(project, new Revision(
        -1, new Branch(project, (config.project.branch === "") ? "" : config.project.branch))); // we'll always use the latest revision
        
    // create the output folder
    const filePath = './out';
    if( !fs.existsSync(filePath)){
        fs.mkdirSync(filePath);    
    }
    

    //Get logging module
    const loggingModuleName = "CustomLogging"
    let loggingModules = workingCopy.model().allModules().filter(m => {             
        if (m.name == loggingModuleName) {
            return true
        }      
        return false
    });

    if (loggingModules.length > 0) {
        let [loggingModule] = loggingModules
        const pages = workingCopy.model().allPages()

    for (const page of pages) {
        const loadedDocument = await loadPageAsPromise(page);
        var filepath = getSanitisedAndUniqueFilePath (filePath, loadedDocument.name, '_')
        let pageName = page.qualifiedName!

        const pageParameterEntityName = getPageParameterFromPage (page)
        
        console.log (`Creating microflow for page name ${pageName}`)
        createMicroflows(workingCopy, loggingModule, pageName, pageParameterEntityName); //Update entity name 
        console.log (`Finished creating microflow for page name ${pageName}`) 
    }

     workingCopy.commit((config.project.branch === "") ? null : config.project.branch)
         .done(
             () => {
                 console.log("Commit complete. Please update your project in the modeller.");
             },
             error => {
                 console.log("Something went wrong.");
                 console.dir(error);
             });
    }
    
     else {
         console.log ('No such logging module found')
    }
};

execute();


function createMicroflows(workingCopy: OnlineWorkingCopy, module: projects.IModule, pageName: string, entityName: string|null) {    

            var pageNameTrimmed= pageName.substring(pageName.indexOf(".") + 1);
            var moduleName = module.name
            var microflowName = `ACT_Page_${moduleName}_${pageNameTrimmed}_Open`;
            var folderBase = module.domainModel.containerAsFolderBase
            
            let folder : projects.IFolderBase = createFolder(folderBase, config.app.folderName);  
            console.log( `-> ${microflowName}`);
            var mf = workingCopy.model().findMicroflowByQualifiedName(moduleName + '.' + microflowName);
            if( !mf ){          
                createLoggingMicroflow(workingCopy.model(),microflowName, pageName, folder, entityName);
            }
            else{
                console.log( `\t\t!!! Microflow '${microflowName}' not created. A microflow with that name already exists.`);
            }                        
        console.log( `<-- ${moduleName}`);
    }

function createFolder(folderBase : projects.IFolderBase, folderName: string): projects.IFolderBase {
    let folder = folderBase.folders.find(f=>f.name == folderName);
    if( !folder ){
        folder = projects.Folder.createIn(folderBase);
        folder.name = folderName;
    }  
    return folder; 
}

function createLoggingMicroflow (model: IModel, microflowName : string, pageName : string, folder : projects.IFolderBase, entityName: string|null) {
    let lastActivity : microflows.MicroflowObject;

    const mfReturnType = datatypes.BooleanType.create(model);
    let microflow : Microflow = new Microflow(model, folder, microflowName, mfReturnType);
    
    // START
    const startEvent = microflow.generateStartEvent();
    microflow.addObjectToMicroflow(
        startEvent, 0, 0, null, Microflow.ConnectorPosition.Right, Microflow.ConnectorPosition.Left);
    lastActivity = startEvent;

    //Java action
    const IPAdressJavaAction = microflow.generateJavaAction ("CustomLogging.Java_IPAddress", true, "IPAddress")
    microflow.addObjectToMicroflow (IPAdressJavaAction, 200, 0, lastActivity, Microflow.ConnectorPosition.Right,Microflow.ConnectorPosition.Left)
    lastActivity = IPAdressJavaAction

    const browserTypeJavaAction = microflow.generateJavaAction ("CustomLogging.Java_BrowserType", true, "BrowserType")
    microflow.addObjectToMicroflow (browserTypeJavaAction, 200, 0, lastActivity, Microflow.ConnectorPosition.Right,Microflow.ConnectorPosition.Left)
    lastActivity = browserTypeJavaAction

    //Logging activity
    const loggingActivity = microflow.generateLogMessage (pageName)
    microflow.addObjectToMicroflow (loggingActivity, 200, 0, lastActivity, Microflow.ConnectorPosition.Right,Microflow.ConnectorPosition.Left)
    lastActivity = loggingActivity

    //Parameter if Page has page parameter
    if (entityName) {
        var pageParam = datatypes.ObjectType.create(model);
        pageParam.entity = model.findEntityByQualifiedName(entityName)!; //Is there a better way to do this

        microflow.addInputParameter (entityName, pageParam)

    }
    
    //Page open activity
    const pageOpenActivity = microflow.generatePageOpenCall (pageName, entityName)
    microflow.addObjectToMicroflow (pageOpenActivity, 200, 0, lastActivity, Microflow.ConnectorPosition.Right,Microflow.ConnectorPosition.Left)
    lastActivity = pageOpenActivity

    // END
    const endEvent = microflow.generateEndEvent("true");
    microflow.addObjectToMicroflow(
        endEvent, 100, 0, lastActivity, Microflow.ConnectorPosition.Right, Microflow.ConnectorPosition.Left);
    lastActivity = endEvent;
}

function loadPageAsPromise (page: pages.IPage): when.Promise<pages.Page> {
    return when.promise<pages.Page>((resolve, reject) => page.load(resolve));
}

function getSanitisedAndUniqueFilePath(basePath : string, filename : string | null, replaceValue : string, attempt : number = 1) : string {
    filename = filename || "";
    filename = filename.replace(/[/\\?%*:|"<>]/g, replaceValue);
    if(!filename.endsWith(".js")){
        filename += '.js';
    }
    let filePath = path.join(basePath, filename);

    if(fs.existsSync(filePath)){
        filename = filename + `${attempt}`;
        filePath = getSanitisedAndUniqueFilePath(basePath, filename, replaceValue, attempt++);
    }

    return filePath;
}

/**
* Traverses a given structure and returns all buttons, controlbar buttons and listviews
*/
function getStructures(structure: IStructure): IStructure[] {

    var structures: any[] = [];
    structure.traverse(function(structure) {
        if (structure instanceof domainmodels.DirectEntityRef)  {
            structures.push(structure);
        }
    });
    return structures;
}

function getPageParameterFromPage (page:pages.IPage): string|null {
    const pageStructures = getStructures (page)
    let entityRefs = pageStructures.filter(p => p instanceof domainmodels.DirectEntityRef) as domainmodels.DirectEntityRef[];

    if (entityRefs.length === 0) {
        return null
    }

    if (entityRefs.length > 1) {
        throw new Error (`Uh oh, more than 1 page parameter for ${page.name}`)
        return null
    }

    else {
        const [entityRef] = entityRefs
        if (entityRef.entity) {
            return entityRef.entity.qualifiedName;
        }
        else return null
    }
}