import {MendixSdkClient, Project, OnlineWorkingCopy, Revision, Branch} from 'mendixplatformsdk/dist';
import {IModel, IStructure, IStructuralUnit, microflows, projects, datatypes, domainmodels, pages} from 'mendixmodelsdk/dist';
import {Microflow} from './mendix-component-creators/Microflow';
import fs = require('fs')
import when = require('when');
var path = require('path');

import { IntegrationTraining as config} from '../config' 


const client = new MendixSdkClient(config.auth.username, config.auth.apikey);
const project = new Project(client,config.project.id, config.project.name);

async function execute(){   
    const workingCopy = await client.platform().createOnlineWorkingCopy(project, new Revision(
        -1, new Branch(project, (config.project.branch === "") ? "" : config.project.branch))); // we'll always use the latest revision
           
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
        var folderBase = loggingModule.domainModel.containerAsFolderBase
        let folder : projects.IFolderBase = createFolder(folderBase, config.app.folderName);  
        let count = 0
    for (const page of pages) {
        const loadedPage = await loadPageAsPromise(page);
        let pageName = page.qualifiedName!
        const pageParameterEntityName = getPageParameterFromPage (loadedPage) 
        let structuralUnit = page as IStructuralUnit 
        let moduleName = getContainingModuleName (structuralUnit)
        
        let moduleFolder = loggingModule.traverseFind (function (structure) {
            if (structure instanceof projects.Folder) {
                let folder = structure as projects.Folder
                if (folder.name === moduleName) {
                    return folder
                }                
            }
        }) //Returns folder where folder name is moduleName

        if (!moduleFolder) {
            let newFolder = createFolder (folder, moduleName)
            createMicroflows(workingCopy, loggingModule, pageName, pageParameterEntityName, newFolder) 
            count++
        }

        else {
            createMicroflows(workingCopy, loggingModule, pageName, pageParameterEntityName, moduleFolder) //If statement covers where folder cannot be found. Is there a better way?
            count++
        }
       
    }

    console.log (`${count} microflows succesfully created`)

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


function createMicroflows(workingCopy: OnlineWorkingCopy, module: projects.IModule, pageName: string, entityName: string|null, folder:projects.IFolderBase) {    

            var pageNameTrimmed= pageName.substring(pageName.indexOf(".") + 1);
            var moduleName = module.name
            var microflowName = `ACT_${pageNameTrimmed}_OpenWithLog`;
 
            var mf = workingCopy.model().findMicroflowByQualifiedName(moduleName + '.' + microflowName);
            if( !mf ){          
                createLoggingMicroflow(workingCopy.model(),microflowName, pageName, folder, entityName);
            }
            else{
                console.log( `\t\t!!! Microflow '${microflowName}' not created. A microflow with that name already exists.`);
            }                        
    }

function createFolder(folderBase : projects.IFolderBase, folderName: string): projects.IFolderBase {
    let folder = folderBase.folders.find(f=>f.name == folderName);
    if( !folder ){
        folder = projects.Folder.createIn(folderBase);
        folder.name = folderName;
        console.log (folder.name)
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

    //Page Open activity
    const pageOpenActivity = microflow.generatePageOpenCall (pageName, entityName)
    microflow.addObjectToMicroflow (pageOpenActivity, 200, 0, lastActivity, Microflow.ConnectorPosition.Right,Microflow.ConnectorPosition.Left)
    lastActivity = pageOpenActivity

    // END
    const endEvent = microflow.generateEndEvent("false");
    microflow.addObjectToMicroflow(
        endEvent, 100, 0, lastActivity, Microflow.ConnectorPosition.Right, Microflow.ConnectorPosition.Left);
    lastActivity = endEvent;
}

function loadPageAsPromise (page: pages.IPage): when.Promise<pages.Page> {
    return when.promise<pages.Page>((resolve, reject) => page.load(resolve));
}


/**
* Traverses a given structure and returns all buttons, controlbar buttons and listviews
*/
function getDirectEntityRefs(structure: IStructure): IStructure[] {
    var structures: any[] = [];
    structure.traverse(function(structure) {
        if (structure instanceof domainmodels.DirectEntityRef)  {
            structures.push(structure);
        }
    });
    return structures;
}

function getPageParameterFromPage (page:pages.Page): string|null {
    if (!page.excluded) {
        const pageStructures = getDirectEntityRefs (page)
        let entityRefs = pageStructures.filter(p => p instanceof domainmodels.DirectEntityRef) as domainmodels.DirectEntityRef[]
        let dataViewEntityRefs = entityRefs.filter (e => e.container instanceof pages.DataViewSource ) 

        if (dataViewEntityRefs.length >= 1) {
            const [dataViewEntityRef] = dataViewEntityRefs //Where more than one reference is made. The page parameter will always be the first in the array
            return dataViewEntityRef.entity.qualifiedName
        }
    }     
        return null
}

function getContainingModuleName(container : IStructuralUnit) : string{
    if(container.structureTypeName != "Projects$Module"){
        return getContainingModuleName(container.container)
    }
    else {
        return (container as projects.Module).name
    }    
}
