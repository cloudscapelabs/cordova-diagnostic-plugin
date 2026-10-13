#!/usr/bin/env node

/**********
 * Globals
 **********/

const PLUGIN_NAME = "Diagnostic plugin";
const PLUGIN_ID = "cordova.plugins.diagnostic";
const PREFERENCE_NAME = PLUGIN_ID + ".modules";

const MODULES = [
    "LOCATION",
    "BLUETOOTH",
    "WIFI",
    "CAMERA",
    "NOTIFICATIONS",
    "MICROPHONE",
    "CONTACTS",
    "CALENDAR",
    "REMINDERS",
    "MOTION",
    "NFC",
    "EXTERNAL_STORAGE",
    "AIRPLANE_MODE"
];

const COMMENT_START = "<!--";
const COMMENT_END = "-->";

// Node dependencies
var path, cwd, fs;

// External dependencies
var et;

// Internal dependencies
var logger;

var projectPath, modulesPath, pluginNodePath, pluginScriptsPath, configXmlPath, pluginXmlPath, configXmlData, pluginXmlText;


/*********************
 * Internal functions
 *********************/

var run = function (){
    var configuredModules = getSelectedModules();
    logger.verbose("Modules: " + configuredModules);

    readPluginXml();
    enableAllModules();
    if(configuredModules){
        MODULES.forEach(function(module){
            if(configuredModules.indexOf(module) === -1){
                disableModule(module);
            }
        });
    }

    writePluginXml();
};


var handleError = function (error) {
    error = PLUGIN_NAME + " - ERROR: " + error;
    if(logger){
        logger.error(error);
    }else{
        console.log(error);
        console.error(error)
    }
    return error;
};

// Parses a given file into an elementtree object
var parseElementtreeSync = function(filename) {
    var contents = fs.readFileSync(filename, 'utf-8');
    if(contents) {
        //Windows is the BOM. Skip the Byte Order Mark.
        contents = contents.substring(contents.indexOf('<'));
    }
    return new et.ElementTree(et.XML(contents));
};

// Parses the config.xml into an elementtree object and stores in the config object
var getConfigXml = function() {
    if(!configXmlData) {
        configXmlData = parseElementtreeSync(configXmlPath);
    }
    return configXmlData;
};

var readPluginXml = function(){
    pluginXmlText = fs.readFileSync(pluginXmlPath, 'utf-8');
};

var writePluginXml = function(){
    fs.writeFileSync(pluginXmlPath, pluginXmlText, 'utf-8');
};

var getSelectedModules = function(){
    var modules = null;
    var preference = getConfigXml().findall("preference[@name='"+PREFERENCE_NAME+"']")[0];
    if(preference){
        modules = preference.attrib.value.split(' ');
    }
    return modules;
};

var enableAllModules = function(){
    MODULES.forEach(function(module){
        var commentedStartRegExp = new RegExp(getModuleStart(module)+COMMENT_START, "g");
        var commentedEndRegExp = new RegExp(COMMENT_END+getModuleEnd(module), "g");
        if(pluginXmlText.match(commentedStartRegExp)){
            pluginXmlText = pluginXmlText.replace(commentedStartRegExp, getModuleStart(module));
            pluginXmlText = pluginXmlText.replace(commentedEndRegExp, getModuleEnd(module));
        }
    });
};

var disableModule = function(module){
    var commentedStart = getModuleStart(module)+COMMENT_START;
    var commentedEnd = COMMENT_END+getModuleEnd(module);
    pluginXmlText = pluginXmlText.replace(new RegExp(getModuleStart(module), "g"), commentedStart);
    pluginXmlText = pluginXmlText.replace(new RegExp(getModuleEnd(module), "g"), commentedEnd);
};

var getModuleStart = function(module){
    return "<!--BEGIN_MODULE "+module+"-->";
};

var getModuleEnd = function(module){
    return "<!--END_MODULE "+module+"-->";
};


/**********
 * Main
 **********/
// Walk up from the starting directory to find the Cordova project containing config.xml.
// Paths are not derived from the plugin location because scoped packages (e.g. node_modules/@scope/plugin)
// and linked packages do not sit exactly two levels below the project.
var findProjectPath = function(startPath){
    var dir = startPath;
    while(true){
        if(fs.existsSync(path.join(dir, 'config.xml'))){
            return dir;
        }
        var parent = path.dirname(dir);
        if(parent === dir){
            return null;
        }
        dir = parent;
    }
};

var main = function() {
    try{
        fs = require('fs');
        path = require('path');
        cwd = process.env.INIT_CWD || process.cwd();

        pluginScriptsPath = __dirname;
        pluginNodePath = path.resolve(pluginScriptsPath, "..");
        projectPath = findProjectPath(cwd);

        if(!projectPath){
            var message = "Could not find config.xml in or above " + cwd + "; modules preference not applied, all modules remain enabled.";
            // npm may run postinstall before the Cordova project config exists; the explicit run must succeed.
            if(process.env.npm_lifecycle_event === 'postinstall'){
                console.warn(PLUGIN_NAME + " - WARNING: " + message);
                return;
            }
            throw new Error(message);
        }

        modulesPath = path.join(projectPath, "node_modules");
        logger = require(path.join(pluginScriptsPath, "logger.js"))(projectPath, PLUGIN_ID);
        et = require(require.resolve("elementtree", { paths: [pluginNodePath, projectPath] }));

        configXmlPath = path.join(projectPath, 'config.xml');
        pluginXmlPath = path.join(pluginNodePath, "plugin.xml");
        run();
        logger.log("Applied modules preference from " + configXmlPath + " to " + pluginXmlPath);
    }catch(e){
        handleError(e.message);
        process.exitCode = 1;
    }
};

main();