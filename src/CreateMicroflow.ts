import {MendixSdkClient, Project, OnlineWorkingCopy, Revision, Branch} from 'mendixplatformsdk/dist';
import {IModel,domainmodels, microflows, projects, datatypes} from 'mendixmodelsdk/dist';
import {Microflow} from './mendix-component-creators/Microflow';
import { eServices as config} from '../config' 


const client = new MendixSdkClient(config.auth.username, config.auth.apikey);
const project = new Project(client,config.project.id, config.project.name);

async function execute(){   
    const workingCopy = await client.platform().createOnlineWorkingCopy(project, new Revision(
        -1, new Branch(project, (config.project.branch === "") ? "" : config.project.branch))); // we'll always use the latest revision
        "src/ValidationCreator.ts"
    const loggingModuleName = "CustomLogging"
    const pageName = "ApplicationAdministration.Page_TechnicalAdminPortal"
    let allModules = workingCopy.model().allModules()
    let loggingModules = workingCopy.model().allModules().filter(m => {             
        if (m.name == loggingModuleName) {
            return true
        }      
        return false
    });

    allModules.map ((m) => {
        console.log (m.name)
    })
        
    console.log (loggingModules)

    if (loggingModules.length > 0) {

    let [loggingModule] = loggingModules

    createMicroflows(workingCopy, loggingModule, pageName);

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


function createMicroflows(workingCopy: OnlineWorkingCopy, module: projects.IModule, pageName: string) {    

            var microflowName = `ACT_Page_${pageName}_Open`;
            var moduleName = module.name
            var folderBase = module.domainModel.containerAsFolderBase
            
            let folder : projects.IFolderBase = createFolder(folderBase, config.app.folderName);  
            console.log( `-> ${microflowName}`);
            var mf = workingCopy.model().findMicroflowByQualifiedName(moduleName + '.' + microflowName);
            if( !mf ){          
                createLoggingMicroflow(workingCopy.model(),microflowName, pageName, folder);
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

function createLoggingMicroflow (model: IModel, microflowName : string, pageName : string, folder : projects.IFolderBase) {
    let lastActivity : microflows.MicroflowObject;

    const mfReturnType = datatypes.BooleanType.create(model);
    let microflow : Microflow = new Microflow(model, folder, microflowName, mfReturnType);
    
    // START
    const startEvent = microflow.generateStartEvent();
    microflow.addObjectToMicroflow(
        startEvent, 0, 0, null, Microflow.ConnectorPosition.Right, Microflow.ConnectorPosition.Left);
    lastActivity = startEvent;

    //Logging activity
    const loggingActivity = microflow.generateLoggingPageMicroflowCall (pageName)
    microflow.addObjectToMicroflow (loggingActivity, 100, 0, lastActivity, Microflow.ConnectorPosition.Right,Microflow.ConnectorPosition.Left)
    lastActivity = loggingActivity

    //Page open activity
    const pageOpenActivity = microflow.generatePageOpenCall (pageName)
    microflow.addObjectToMicroflow (pageOpenActivity, 100, 0, lastActivity, Microflow.ConnectorPosition.Right,Microflow.ConnectorPosition.Left)
    lastActivity = pageOpenActivity

    // END
    const endEvent = microflow.generateEndEvent("");
    microflow.addObjectToMicroflow(
        endEvent, 100, 0, lastActivity, Microflow.ConnectorPosition.Right, Microflow.ConnectorPosition.Left);
    lastActivity = endEvent;

    console.log (microflow)
}

