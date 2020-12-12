import {MendixSdkClient, Project, OnlineWorkingCopy, Revision, Branch} from 'mendixplatformsdk/dist';
import {JavaScriptSerializer, StructuralUnit, IStructuralUnit, projects, constants, 
        javaactions, pages, microflows, enumerations, exportmappings, importmappings,
        scheduledevents, xmlschemas, domainmodels, images, jsonstructures, security} from 'mendixmodelsdk/dist';
import when = require('when');
import {eServices as config} from '../config' // Change this to change project
import fs = require('fs');;
var path = require('path');

const client = new MendixSdkClient(config.auth.username, config.auth.apikey);
const project = new Project(client,config.project.id, config.project.name);
const revision = new Revision(-1, new Branch(project,config.project.branch)); // always use the latest revision

async function serialize(){
    const wc : OnlineWorkingCopy = await client.platform().createOnlineWorkingCopy(project, revision);
    
    // create the output folder
    const basePath = './out';
    if( !fs.existsSync(basePath)){
        fs.mkdirSync(basePath);    
    }

    const mfName = 'ACT_PageOpenDemo' //Change this to export different microflows

    await exportMicroflow (wc, basePath, mfName)
}

serialize();


async function exportMicroflow(wc : OnlineWorkingCopy, filePath : string, mfName:string){

    const mfs = wc.model().allMicroflows()
        const filteredMF = mfs.filter (mf => {
                if (mf.name === mfName) {
                        return true
                }
                return false
        })

    for (const mf of filteredMF) {
        const loadedDocument = await loadAsPromise<microflows.IMicroflow>(mf);
        var filepath = getSanitisedAndUniqueFilePath (filePath, loadedDocument.name, '_')
        const serialised = JavaScriptSerializer.serializeToJs(loadedDocument);
        fs.writeFileSync(filepath,serialised );
    }
    console.log(`Microflow exported`);
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

interface Loadable<T> {
    load(callback: (result: T) => void): void;
}

function loadAsPromise<T>(loadable: Loadable<T>): when.Promise<T> {
    return when.promise<T>((resolve, reject) => loadable.load(resolve));
}
