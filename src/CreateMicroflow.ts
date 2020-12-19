import {MendixSdkClient, Project, OnlineWorkingCopy, Revision, Branch} from 'mendixplatformsdk/dist';
import {IModel, microflows, projects, datatypes} from 'mendixmodelsdk/dist';
import {Microflow} from './mendix-component-creators/Microflow';
import { DemoApplication as config} from '../config' 


const client = new MendixSdkClient(config.auth.username, config.auth.apikey);
const project = new Project(client,config.project.id, config.project.name);

async function execute(){   
    const workingCopy = await client.platform().createOnlineWorkingCopy(project, new Revision(
        -1, new Branch(project, (config.project.branch === "") ? "" : config.project.branch))); // we'll always use the latest revision
    const loggingModuleName = "CustomLogging"
    const pageName = "CustomLogging.Page_Test"
    let allModules = workingCopy.model().allModules()
    let loggingModules = workingCopy.model().allModules().filter(m => {             
        if (m.name == loggingModuleName) {
            return true
        }      
        return false
    });

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

            var pageNameTrimmed= pageName.substring(pageName.indexOf(".") + 1);
            var moduleName = module.name
            var microflowName = `ACT_Page_${moduleName}_${pageNameTrimmed}_Open`;
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

    //Page open activity
    const pageOpenActivity = microflow.generatePageOpenCall (pageName)
    microflow.addObjectToMicroflow (pageOpenActivity, 200, 0, lastActivity, Microflow.ConnectorPosition.Right,Microflow.ConnectorPosition.Left)
    lastActivity = pageOpenActivity

    // END
    const endEvent = microflow.generateEndEvent("true");
    microflow.addObjectToMicroflow(
        endEvent, 100, 0, lastActivity, Microflow.ConnectorPosition.Right, Microflow.ConnectorPosition.Left);
    lastActivity = endEvent;
}

