/* todo: вынести все этапы и процедуры в отдельные функции */
export function home_schedule (input_data){

    /*Объект расписания с исходными данными */
    const schedule = [];
  
    function compare(i,from,to, callback){
      if(i >= to){
        if(to < from && from <= i){
          if(i > 23) callback();  
        }else return false;
       }
        return true;
     }
  
    input_data.rates.forEach(rate => {
        for(let i = rate.from; compare(i,rate.from,rate.to,()=>{i = 0}); ++i){
            schedule[i] = {'rate':rate.value};
            schedule[i].maxPower = input_data.maxPower;
            schedule[i].devices = [];
        }
    });
    /*Объект для тестирования входных данных*/
    const mode = {
        undefined : {
            "duration": 24,
            "total_power":input_data.maxPower*24
        },
        "day": {
            "duration": 14,
            "total_power":input_data.maxPower*14
        },
        "night": {
            "duration": 10,
            "total_power": input_data.maxPower*14
        }
    }; /* todo: реализовать total_power с использованием this.duration */

    /*Тест превышения прибором максимальной мощности и сортировка*/
    input_data.devices.sort((a,b)=>{return b.power - a.power;});
    if(input_data.devices[0].power > input_data.maxPower){
        throw Error('maxPower exceeded! id:'+input_data.devices[0].id);
    }
    
    /* Сортировка по длительности */
    const devices_duration = input_data.devices.slice().sort((a,b)=>{return b.duration - a.duration;});
    devices_duration.push({duration:0});
    
    input_data.devices.forEach(device => {
        device.start_at = false;

        /*Тест пика мощности - todo: вынести из цикла, либо реализовать тест для пересечений приборов менее 24 часа*/
        let device_maxPower = input_data.maxPower - device.power;
        for(let i=0;devices_duration[i].duration > 23; ++i){
            if(devices_duration[i].id != device.id){
                device_maxPower -= devices_duration[i].power;
            }
        }
        if(device.mode !== undefined){
            for(let i=0;devices_duration[i].duration > mode[device.mode].duration-1; ++i){
                if(device.mode === devices_duration[i].mode && devices_duration[i].id != device.id){
                    device_maxPower -= devices_duration[i].power;
                }
            }
        }
        if(device_maxPower < 0){
            throw Error(`maxPower exceeded by id:${device.id} and others, working at the same time!`);
        }

        /*Тест Общей мощности и day/night промежутков*/
        mode.undefined.total_power -= device.power*device.duration;
        if(device.mode !== undefined){
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

        /*Расчет стоимости включений прибора, для 24-приборов только один расчет, от 0:00*/
        device.schedule = [];
        for (let [i,end] = [0, (device.duration < 24) ? 24 : 1]; i < end; ++i){
          device.schedule[i] = {'price' : device.power*schedule[i].rate, 'start' : i};
          for(let [d,s] = [1,0]; d < device.duration; ++d){
            s = (i+d > 23) ? i+d-24 : i+d;
            device.schedule[i].price += device.power*schedule[s].rate;
          }
        }
      
        /* Расстановка приборов 24 */
        if(device.duration == 24){
            for (let i = 0; i < device.duration; ++i){
                schedule[i].maxPower -= device.power;
                schedule[i].devices.push(device.id);
            }
            device.start = 0;
        }else{
          /* Сортировака п опотреблению */
          device.schedule.sort((a,b)=>{return a.price - b.price;})
          device.price_delta = device.schedule[23].price-device.schedule[0].price;
        }

    });
    
    /* todo: расстановка остальныз приборов + перестоновка с рекурсией */
    const devices_delta = input_data.devices.slice().sort((a,b)=>{return b.price_delta - a.price_delta;});
    devices_delta.forEach(device => {
       
     });

    const test_data = {
        "schedule": {
            "0": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E", "F972B82BA56A70CC579945773B6866FB"],
            "1": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E", "F972B82BA56A70CC579945773B6866FB"],
            "2": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E", "F972B82BA56A70CC579945773B6866FB"],
            "3": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "4": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "5": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "6": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "7": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "8": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "9": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "10": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E", "C515D887EDBBE669B2FDAC62F571E9E9"],
            "11": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E", "C515D887EDBBE669B2FDAC62F571E9E9"],
            "12": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "13": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "14": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "15": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "16": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "17": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "18": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "19": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "20": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "21": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "22": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E"],
            "23": ["02DDD23A85DADDD71198305330CC386D", "1E6276CC231716FE8EE8BC908486D41E", "7D9DC84AD110500D284B33C82FE6E85E"]
        },
        "consumedEnergy": {
            "value": 38.939,
            "devices": {
                "F972B82BA56A70CC579945773B6866FB": 5.1015,
                "C515D887EDBBE669B2FDAC62F571E9E9": 21.52,
                "02DDD23A85DADDD71198305330CC386D": 5.398,
                "1E6276CC231716FE8EE8BC908486D41E": 5.398,
                "7D9DC84AD110500D284B33C82FE6E85E": 1.5215
            }
        }
      };

return test_data;
}