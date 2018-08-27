export function home_schedule (input_data){

}

function max_power_test(test_data){

    const mode = {
        undefined : {
            "duration": 24,
            "total_power":test_data.maxPower*24
        },
        "day": {
            "duration": 14,
            "total_power":test_data.maxPower*14
        },
        "night": {
            "duration": 10,
            "total_power": test_data.maxPower*14
        }
    }; // todo: реализовать total_power с использованием this.duration, 

    const devices_duration = test_data.devices.slice().sort((a,b)=>{return b.duration - a.duration;});
    devices_duration.push({duration:0});

    /*Превышение одним прибором максимальной мощности*/
    test_data.devices.sort((a,b)=>{return b.power - a.power;});
    if(test_data.devices[0].power > test_data.maxPower){
        throw Error('maxPower exceeded! id:'+test_data.devices[0].id);
    }

    test_data.devices.forEach(device =>{

        /*Пик мощности*/
        let device_maxPower = test_data.maxPower - device.power;

        for(let i=0;devices_duration[i].duration > 23; ++i){
            if(devices_duration[i].id != device.id){ /*todo реализовать через фильтрацию массива?*/
                device_maxPower -= devices_duration[i].power;
            }
        }
        if(device.mode != undefined){
            for(let i=0;devices_duration[i].duration > mode[device.mode].duration-1; ++i){
                if(device.mode === devices_duration[i].mode && devices_duration[i].id != device.id){
                    device_maxPower -= devices_duration[i].power;
                }
            }
        }
        if(device_maxPower < 0){
            throw Error(`maxPower exceeded by id:${device.id} and others working at the same time!`);
        }
        //console.log(device_maxPower);

        /*Общая мощность в определенные промежутки*/
        mode.undefined.total_power -= device.power*device.duration;
        if(device.mode != undefined){
            mode[device.mode].total_power -= device.power*device.duration;
        }else{
            if(device.duration > mode.night.duration){
                mode.day.total_power -= device.power*(device.duration-mode.night.duration);
            }
            if(device.duration > mode.day.duration){
                mode.night.total_power -= device.power*(device.duration-mode.day.duration);
            }
        }

        Object.keys(mode).forEach(mode_name =>{
            if(mode[mode_name].total_power < 0){
                throw Error(`maxPower exceeded by total power of ${mode_name}-mode devices!`);
            }
        });
    });


    //console.log(mode);
}